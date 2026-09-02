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
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Fetch inventory and sales data
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get products with current stock levels
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        id,
        name,
        sku,
        price,
        cost,
        quantity,
        low_stock_threshold,
        reorder_quantity,
        auto_reorder,
        categories(name)
      `)
      .order('quantity', { ascending: true });

    if (productsError) {
      console.error('Products fetch error:', productsError);
      throw new Error('Failed to fetch products');
    }

    // Get sales data from transaction items for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: salesData, error: salesError } = await supabase
      .from('transaction_items')
      .select(`
        product_id,
        product_name,
        quantity,
        unit_price,
        total_price,
        created_at
      `)
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (salesError) {
      console.error('Sales fetch error:', salesError);
      throw new Error('Failed to fetch sales data');
    }

    // Get pending reorders
    const { data: pendingReorders } = await supabase
      .from('reorder_requests')
      .select('product_id, quantity, status')
      .eq('status', 'pending');

    // Aggregate sales by product
    const salesByProduct: Record<string, { totalSold: number; totalRevenue: number; salesCount: number }> = {};
    
    salesData?.forEach(item => {
      if (!salesByProduct[item.product_id]) {
        salesByProduct[item.product_id] = { totalSold: 0, totalRevenue: 0, salesCount: 0 };
      }
      salesByProduct[item.product_id].totalSold += item.quantity;
      salesByProduct[item.product_id].totalRevenue += item.total_price;
      salesByProduct[item.product_id].salesCount += 1;
    });

    // Prepare inventory context for AI
    const inventoryContext = products?.map(p => {
      const sales = salesByProduct[p.id] || { totalSold: 0, totalRevenue: 0, salesCount: 0 };
      const dailyAvgSales = sales.totalSold / 30;
      const daysOfStock = dailyAvgSales > 0 ? Math.round(p.quantity / dailyAvgSales) : 999;
      const hasPendingReorder = pendingReorders?.some(r => r.product_id === p.id);
      
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: (p.categories as any)?.name || 'Uncategorized',
        currentStock: p.quantity,
        lowStockThreshold: p.low_stock_threshold,
        defaultReorderQty: p.reorder_quantity || 50,
        autoReorderEnabled: p.auto_reorder,
        cost: p.cost,
        price: p.price,
        profitMargin: ((p.price - p.cost) / p.price * 100).toFixed(1),
        last30DaysSales: sales.totalSold,
        last30DaysRevenue: sales.totalRevenue,
        dailyAvgSales: dailyAvgSales.toFixed(2),
        daysOfStock,
        hasPendingReorder,
        isLowStock: p.quantity <= p.low_stock_threshold,
        isOutOfStock: p.quantity === 0
      };
    }) || [];

    // Use AI to generate recommendations
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are an inventory management AI assistant for a retail store. Analyze the inventory data and sales trends to provide intelligent reorder recommendations.

Consider these factors:
1. Current stock levels vs low stock thresholds
2. Daily average sales velocity
3. Days of stock remaining
4. Profit margins (prioritize high-margin items)
5. Existing pending reorders
6. Seasonal patterns (if detectable)
7. Cost of carrying inventory

Provide actionable recommendations that help optimize:
- Stock availability (prevent stockouts)
- Cash flow (don't over-order slow movers)
- Profitability (prioritize high-margin items)

Be specific with quantities and reasoning.`
          },
          {
            role: 'user',
            content: `Analyze this inventory data and provide reorder recommendations:

${JSON.stringify(inventoryContext, null, 2)}

Please provide:
1. Urgent reorders (items at risk of stockout)
2. Recommended reorders (items approaching low stock)
3. Optimization suggestions (slow movers, overstocked items)
4. Overall inventory health summary`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'inventory_recommendations',
              description: 'Return inventory recommendations',
              parameters: {
                type: 'object',
                properties: {
                  urgentReorders: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        productId: { type: 'string' },
                        productName: { type: 'string' },
                        currentStock: { type: 'number' },
                        recommendedQuantity: { type: 'number' },
                        reason: { type: 'string' },
                        priority: { type: 'string', enum: ['critical', 'high'] }
                      },
                      required: ['productId', 'productName', 'recommendedQuantity', 'reason', 'priority']
                    }
                  },
                  recommendedReorders: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        productId: { type: 'string' },
                        productName: { type: 'string' },
                        currentStock: { type: 'number' },
                        recommendedQuantity: { type: 'number' },
                        reason: { type: 'string' },
                        estimatedDaysUntilStockout: { type: 'number' }
                      },
                      required: ['productId', 'productName', 'recommendedQuantity', 'reason']
                    }
                  },
                  optimizationSuggestions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        type: { type: 'string', enum: ['slow_mover', 'overstock', 'pricing', 'discontinue'] },
                        productName: { type: 'string' },
                        suggestion: { type: 'string' },
                        potentialSavings: { type: 'string' }
                      },
                      required: ['type', 'productName', 'suggestion']
                    }
                  },
                  healthSummary: {
                    type: 'object',
                    properties: {
                      overallScore: { type: 'number', description: 'Health score 0-100' },
                      outOfStockCount: { type: 'number' },
                      lowStockCount: { type: 'number' },
                      healthyStockCount: { type: 'number' },
                      overstockedCount: { type: 'number' },
                      insights: { type: 'array', items: { type: 'string' } }
                    },
                    required: ['overallScore', 'insights']
                  }
                },
                required: ['urgentReorders', 'recommendedReorders', 'optimizationSuggestions', 'healthSummary'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'inventory_recommendations' } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      throw new Error('AI gateway error');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      // Return basic recommendations based on data
      const lowStockProducts = inventoryContext.filter(p => p.isLowStock && !p.hasPendingReorder);
      
      return new Response(JSON.stringify({
        urgentReorders: lowStockProducts.filter(p => p.isOutOfStock).map(p => ({
          productId: p.id,
          productName: p.name,
          currentStock: p.currentStock,
          recommendedQuantity: p.defaultReorderQty,
          reason: 'Out of stock',
          priority: 'critical'
        })),
        recommendedReorders: lowStockProducts.filter(p => !p.isOutOfStock).map(p => ({
          productId: p.id,
          productName: p.name,
          currentStock: p.currentStock,
          recommendedQuantity: p.defaultReorderQty,
          reason: 'Below low stock threshold'
        })),
        optimizationSuggestions: [],
        healthSummary: {
          overallScore: 70,
          outOfStockCount: inventoryContext.filter(p => p.isOutOfStock).length,
          lowStockCount: lowStockProducts.length,
          healthyStockCount: inventoryContext.filter(p => !p.isLowStock).length,
          overstockedCount: 0,
          insights: ['Basic analysis - AI recommendations unavailable']
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recommendations = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(recommendations), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('AI inventory recommendations error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
