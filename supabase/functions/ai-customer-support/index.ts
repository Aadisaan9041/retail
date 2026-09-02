import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, trackingNumber } = await req.json();
    
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Fetch context data from database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get store settings from app_settings
    const { data: appSettingsRows } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['appSettings', 'webstoreSettings']);

    // If tracking number provided, fetch order details
    let orderInfo = null;
    if (trackingNumber) {
      const { data: order } = await supabase
        .from('orders')
        .select(`
          *,
          transactions(
            id,
            total,
            payment_method,
            created_at,
            transaction_items(
              product_name,
              quantity,
              unit_price
            )
          ),
          delivery_partners(name, phone, estimated_delivery_time)
        `)
        .eq('tracking_number', trackingNumber)
        .single();
      
      if (order) {
        orderInfo = {
          trackingNumber: order.tracking_number,
          status: order.status,
          customerName: order.customer_name,
          deliveryAddress: order.delivery_address,
          estimatedDelivery: order.estimated_delivery,
          deliveryPartner: (order.delivery_partners as any)?.name,
          items: (order.transactions as any)?.transaction_items || [],
          total: (order.transactions as any)?.total,
          createdAt: order.created_at
        };
      }
    }

    // Get recent products for context
    const { data: products } = await supabase
      .from('products')
      .select('name, price, quantity, categories(name)')
      .gt('quantity', 0)
      .limit(50);

    const productContext = products?.map(p => ({
      name: p.name,
      price: p.price,
      inStock: p.quantity > 0,
      category: (p.categories as any)?.name
    })) || [];

    // Extract store info from settings
    const appSettings = (appSettingsRows?.find(r => r.key === 'appSettings')?.value ?? {}) as Record<string, string>;
    const webSettings = (appSettingsRows?.find(r => r.key === 'webstoreSettings')?.value ?? {}) as Record<string, string>;
    const sName = webSettings.storeName || appSettings.appName || 'Our Store';
    const sEmail = appSettings.contactEmail || '';
    const sPhone = appSettings.contactPhone || '';

    const systemPrompt = `You are a friendly and helpful customer support assistant for ${sName}, an online retail store. Your role is to assist customers with their questions about products, orders, shipping, returns, and store policies.

STORE INFORMATION:
- Store Name: ${sName}
- Contact Email: ${sEmail}
- Phone: ${sPhone}

STORE POLICIES:
- Returns: 30-day return policy for unused items in original packaging
- Shipping: Free shipping on orders over ₹500, standard delivery 3-5 business days
- Payment: We accept UPI, credit/debit cards, and cash on delivery
- Loyalty Program: Earn 1 point per ₹10 spent, 100 points = ₹10 discount

${orderInfo ? `
CUSTOMER'S ORDER INFORMATION:
Tracking Number: ${orderInfo.trackingNumber}
Status: ${orderInfo.status}
Estimated Delivery: ${orderInfo.estimatedDelivery || 'Not available'}
Delivery Partner: ${orderInfo.deliveryPartner || 'Not assigned'}
Order Total: ₹${orderInfo.total}
Items: ${JSON.stringify(orderInfo.items)}
` : ''}

AVAILABLE PRODUCTS (for reference):
${JSON.stringify(productContext.slice(0, 20), null, 2)}

GUIDELINES:
1. Be friendly, empathetic, and professional
2. Provide accurate information based on the context
3. If you don't know something, say so and suggest contacting support
4. For order issues, always ask for the tracking number if not provided
5. Keep responses concise but helpful
6. Use emojis sparingly to be friendly 😊
7. Always end with asking if there's anything else you can help with`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m: any) => ({
            role: m.role,
            content: m.content
          }))
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('AI customer support error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
