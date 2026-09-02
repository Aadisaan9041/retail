import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PriceOverrideAlertRequest {
  email: string;
  productName: string;
  originalPrice: number;
  modifiedPrice: number;
  userName: string;
  reason?: string;
  transactionId?: string;
  threshold: number;
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

    // Verify user is staff (admin/manager only for price override alerts)
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
      productName, 
      originalPrice, 
      modifiedPrice, 
      userName, 
      reason,
      transactionId,
      threshold 
    }: PriceOverrideAlertRequest = await req.json();

    // Validate required fields
    if (!email || !productName || originalPrice === undefined || modifiedPrice === undefined || !userName || threshold === undefined) {
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

    // Validate numeric fields
    if (!Number.isFinite(originalPrice) || !Number.isFinite(modifiedPrice) || !Number.isFinite(threshold)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid numeric values' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Sending price override alert to: ${email} by staff user: ${user.id}`);

    const priceDifference = Math.abs(originalPrice - modifiedPrice);
    const percentageChange = ((priceDifference / originalPrice) * 100).toFixed(1);
    const isDiscount = modifiedPrice < originalPrice;

    const formatCurrency = (value: number) => 
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

    // Sanitize all user-controlled data
    const safeProductName = escapeHtml(String(productName).substring(0, 100));
    const safeUserName = escapeHtml(String(userName).substring(0, 100));
    const safeReason = reason ? escapeHtml(String(reason).substring(0, 500)) : null;
    const safeTransactionId = transactionId ? escapeHtml(String(transactionId).substring(0, 50)) : null;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #ea580c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Price Override Alert</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Threshold exceeded - Immediate attention required</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h2 style="color: #dc2626; margin: 0 0 10px; font-size: 18px;">
              ${isDiscount ? '📉 Discount Applied' : '📈 Price Increased'}
            </h2>
            <p style="margin: 0; font-size: 14px; color: #991b1b;">
              A price modification of <strong>${formatCurrency(priceDifference)}</strong> (${percentageChange}%) 
              exceeds your threshold of <strong>${formatCurrency(threshold)}</strong>
            </p>
          </div>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #eee; color: #6b7280;">Product/Item</td>
              <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 500; text-align: right;">${safeProductName}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #eee; color: #6b7280;">Original Price</td>
              <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 500; text-align: right;">${formatCurrency(originalPrice)}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #eee; color: #6b7280;">Modified Price</td>
              <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 500; text-align: right; color: ${isDiscount ? '#16a34a' : '#dc2626'};">${formatCurrency(modifiedPrice)}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #eee; color: #6b7280;">Modified By</td>
              <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 500; text-align: right;">${safeUserName}</td>
            </tr>
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #eee; color: #6b7280;">Date & Time</td>
              <td style="padding: 12px; border-bottom: 1px solid #eee; font-weight: 500; text-align: right;">${new Date().toLocaleString()}</td>
            </tr>
            ${safeTransactionId ? `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #eee; color: #6b7280;">Transaction ID</td>
              <td style="padding: 12px; border-bottom: 1px solid #eee; font-family: monospace; text-align: right;">${safeTransactionId.slice(0, 8).toUpperCase()}</td>
            </tr>
            ` : ''}
            ${safeReason ? `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #eee; color: #6b7280;">Reason Given</td>
              <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">${safeReason}</td>
            </tr>
            ` : `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #eee; color: #6b7280;">Reason Given</td>
              <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; color: #dc2626;">⚠️ No reason provided</td>
            </tr>
            `}
          </table>
          
          <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px;">
            <p style="margin: 0; font-size: 14px; color: #92400e;">
              <strong>🔍 Recommended Actions:</strong><br>
              • Review this transaction in the Price Override Audit log<br>
              • Verify the reason for this price change<br>
              • Follow up with the staff member if needed
            </p>
          </div>
        </div>
        
        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
          This is an automated fraud prevention alert from Retail Pro POS<br>
          Configure threshold settings in Admin Settings → App Settings
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
        subject: `⚠️ Price Override Alert: ${formatCurrency(priceDifference)} change on ${safeProductName}`,
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();

    console.log("Price override alert sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true, data: emailResult }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in price-override-alert function:", error);
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
