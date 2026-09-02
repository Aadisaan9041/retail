import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BillNotificationRequest {
  email: string;
  customerName: string;
  receiptId: string;
  total: string;
  paymentMethod: string;
  pointsEarned: number;
  items: Array<{ name: string; quantity: number; price: string }>;
  subtotal: string;
  tax: string;
  discount: string | null;
}

// Sanitize HTML to prevent XSS
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate request - REQUIRED
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('Authentication failed:', authError?.message);
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is staff
    const { data: isStaff } = await supabase.rpc('is_staff', { _user_id: user.id });
    if (!isStaff) {
      console.error('Staff access required for user:', user.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Staff access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      email,
      customerName,
      receiptId,
      total,
      paymentMethod,
      pointsEarned,
      items,
      subtotal,
      tax,
      discount,
    }: BillNotificationRequest = await req.json();

    // Validate required fields
    if (!email || !receiptId || !items || !Array.isArray(items)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending bill notification to: ${email} by staff user: ${user.id}`);

    // Sanitize all user-controlled data
    const safeCustomerName = escapeHtml(customerName || 'Valued Customer');
    const safeReceiptId = escapeHtml(receiptId);
    const safeTotal = escapeHtml(total);
    const safeSubtotal = escapeHtml(subtotal);
    const safeTax = escapeHtml(tax);
    const safeDiscount = discount ? escapeHtml(discount) : null;
    const safePaymentMethod = escapeHtml(paymentMethod);
    const safePointsEarned = Number.isFinite(pointsEarned) ? pointsEarned : 0;

    const itemsHtml = items.slice(0, 50).map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${escapeHtml(String(item.name || ''))}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${Number.isFinite(item.quantity) ? item.quantity : 0}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${escapeHtml(String(item.price || ''))}</td>
      </tr>
    `).join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Retail Pro</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Your Digital Receipt</p>
        </div>
        
        <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="margin: 0 0 20px;">Hi ${safeCustomerName},</p>
          <p style="margin: 0 0 20px;">Thank you for shopping with us! Here's your receipt:</p>
          
          <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 2px solid #eee;">
              <div>
                <strong style="color: #666; font-size: 12px;">RECEIPT #</strong>
                <p style="margin: 5px 0 0; font-size: 18px; font-weight: bold;">${safeReceiptId}</p>
              </div>
              <div style="text-align: right;">
                <strong style="color: #666; font-size: 12px;">DATE</strong>
                <p style="margin: 5px 0 0; font-size: 14px;">${new Date().toLocaleDateString()}</p>
              </div>
            </div>
            
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f5f5f5;">
                  <th style="padding: 10px; text-align: left; font-size: 12px; color: #666;">ITEM</th>
                  <th style="padding: 10px; text-align: center; font-size: 12px; color: #666;">QTY</th>
                  <th style="padding: 10px; text-align: right; font-size: 12px; color: #666;">PRICE</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            
            <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #eee;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #666;">Subtotal</span>
                <span>${safeSubtotal}</span>
              </div>
              ${safeDiscount ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #22c55e;">
                  <span>Discount</span>
                  <span>-${safeDiscount}</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="color: #666;">Tax</span>
                <span>${safeTax}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: bold; margin-top: 15px; padding-top: 15px; border-top: 2px solid #333;">
                <span>Total</span>
                <span style="color: #667eea;">${safeTotal}</span>
              </div>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #f0f0ff; border-radius: 8px; text-align: center;">
              <p style="margin: 0; color: #667eea; font-weight: bold;">
                💎 You earned ${safePointsEarned} loyalty points!
              </p>
            </div>
            
            <p style="margin: 20px 0 0; text-align: center; color: #666; font-size: 14px;">
              Payment Method: <strong>${safePaymentMethod}</strong>
            </p>
          </div>
          
          <p style="text-align: center; color: #666; margin: 0;">
            Thank you for shopping with Retail Pro!<br>
            We look forward to serving you again.
          </p>
        </div>
        
        <p style="text-align: center; color: #999; font-size: 12px; margin-top: 20px;">
          This is an automated email. Please do not reply.
        </p>
      </body>
      </html>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Retail Pro <onboarding@resend.dev>",
        to: [email],
        subject: `Your Receipt #${safeReceiptId} from Retail Pro`,
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();

    console.log("Email sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true, data: emailResult }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-bill-notification function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
