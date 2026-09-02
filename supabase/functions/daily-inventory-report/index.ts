import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get alert email from request body or use default
    const body = await req.json().catch(() => ({}));
    const alertEmail = body.email || Deno.env.get("ALERT_EMAIL");

    if (!alertEmail) {
      console.log("No alert email configured, skipping daily report");
      return new Response(
        JSON.stringify({ success: false, message: "No alert email configured" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch products with low stock
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("*")
      .order("quantity", { ascending: true });

    if (productsError) {
      throw productsError;
    }

    const outOfStock = products?.filter(p => p.quantity === 0) || [];
    const lowStock = products?.filter(p => p.quantity > 0 && p.quantity <= p.low_stock_threshold) || [];
    const wellStocked = products?.filter(p => p.quantity > p.low_stock_threshold) || [];

    // Fetch today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("total")
      .gte("created_at", today.toISOString());

    const todaySales = transactions?.reduce((sum, t) => sum + Number(t.total), 0) || 0;
    const todayTransactions = transactions?.length || 0;

    // Generate HTML email
    const outOfStockHtml = outOfStock.slice(0, 10).map(p => `
      <tr style="background: #fef2f2;">
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${p.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
          <span style="background: #dc2626; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px;">OUT</span>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${p.sku}</td>
      </tr>
    `).join("");

    const lowStockHtml = lowStock.slice(0, 10).map(p => `
      <tr style="background: #fffbeb;">
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${p.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">
          <span style="background: #d97706; color: white; padding: 2px 8px; border-radius: 10px; font-size: 12px;">${p.quantity}</span>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${p.sku}</td>
      </tr>
    `).join("");

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 22px;">📊 Daily Inventory Report</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        
        <div style="background: white; padding: 25px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Quick Stats -->
          <div style="display: flex; gap: 10px; margin-bottom: 25px;">
            <div style="flex: 1; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 15px; text-align: center;">
              <p style="font-size: 24px; font-weight: bold; color: #16a34a; margin: 0;">$${todaySales.toFixed(2)}</p>
              <p style="font-size: 11px; color: #166534; margin: 5px 0 0; text-transform: uppercase;">Today's Sales</p>
            </div>
            <div style="flex: 1; background: #eff6ff; border: 1px solid #93c5fd; border-radius: 8px; padding: 15px; text-align: center;">
              <p style="font-size: 24px; font-weight: bold; color: #2563eb; margin: 0;">${todayTransactions}</p>
              <p style="font-size: 11px; color: #1e40af; margin: 5px 0 0; text-transform: uppercase;">Transactions</p>
            </div>
          </div>

          <!-- Inventory Summary -->
          <div style="display: flex; gap: 10px; margin-bottom: 25px;">
            <div style="flex: 1; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; text-align: center;">
              <p style="font-size: 20px; font-weight: bold; color: #dc2626; margin: 0;">${outOfStock.length}</p>
              <p style="font-size: 10px; color: #991b1b; margin: 3px 0 0;">Out of Stock</p>
            </div>
            <div style="flex: 1; background: #fffbeb; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px; text-align: center;">
              <p style="font-size: 20px; font-weight: bold; color: #d97706; margin: 0;">${lowStock.length}</p>
              <p style="font-size: 10px; color: #92400e; margin: 3px 0 0;">Low Stock</p>
            </div>
            <div style="flex: 1; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px; text-align: center;">
              <p style="font-size: 20px; font-weight: bold; color: #16a34a; margin: 0;">${wellStocked.length}</p>
              <p style="font-size: 10px; color: #166534; margin: 3px 0 0;">In Stock</p>
            </div>
          </div>

          ${outOfStock.length > 0 ? `
            <h3 style="font-size: 14px; color: #dc2626; margin: 0 0 10px; display: flex; align-items: center; gap: 6px;">
              🚨 Out of Stock Items
            </h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 8px; text-align: left; font-size: 11px; color: #6b7280;">Product</th>
                  <th style="padding: 8px; text-align: center; font-size: 11px; color: #6b7280;">Status</th>
                  <th style="padding: 8px; text-align: right; font-size: 11px; color: #6b7280;">SKU</th>
                </tr>
              </thead>
              <tbody>${outOfStockHtml}</tbody>
            </table>
          ` : ''}

          ${lowStock.length > 0 ? `
            <h3 style="font-size: 14px; color: #d97706; margin: 0 0 10px; display: flex; align-items: center; gap: 6px;">
              ⚠️ Low Stock Items
            </h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 8px; text-align: left; font-size: 11px; color: #6b7280;">Product</th>
                  <th style="padding: 8px; text-align: center; font-size: 11px; color: #6b7280;">Qty</th>
                  <th style="padding: 8px; text-align: right; font-size: 11px; color: #6b7280;">SKU</th>
                </tr>
              </thead>
              <tbody>${lowStockHtml}</tbody>
            </table>
          ` : ''}

          ${outOfStock.length === 0 && lowStock.length === 0 ? `
            <div style="text-align: center; padding: 30px; background: #f0fdf4; border-radius: 8px;">
              <p style="font-size: 32px; margin: 0;">✅</p>
              <p style="font-size: 16px; font-weight: 500; color: #16a34a; margin: 10px 0 0;">All products are well stocked!</p>
            </div>
          ` : ''}

          <div style="margin-top: 20px; padding: 12px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; text-align: center;">
            <p style="margin: 0; font-size: 13px; color: #0369a1;">
              This is your daily inventory report from <strong>Retail Pro POS</strong>
            </p>
          </div>
        </div>
        
        <p style="text-align: center; color: #9ca3af; font-size: 11px; margin-top: 15px;">
          Sent automatically at ${new Date().toLocaleTimeString()}
        </p>
      </body>
      </html>
    `;

    // Send email
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Retail Pro <onboarding@resend.dev>",
        to: [alertEmail],
        subject: `📊 Daily Report: ${outOfStock.length} out of stock, ${lowStock.length} low stock`,
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log("Daily inventory report sent:", emailResult);

    return new Response(
      JSON.stringify({ success: true, data: emailResult }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in daily-inventory-report:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
