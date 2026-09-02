import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InventoryAlertRequest {
  email: string;
  items: Array<{ name: string; status: string; quantity: number }>;
  type: 'inventory';
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

    // Verify user is staff (admin-only feature)
    const { data: isStaff } = await supabase.rpc('is_staff', { _user_id: user.id });
    if (!isStaff) {
      console.error('Staff access required for user:', user.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Staff access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, items }: InventoryAlertRequest = await req.json();

    // Validate required fields
    if (!email || !items || !Array.isArray(items)) {
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

    console.log(`Sending inventory alert to: ${email} by staff user: ${user.id}`);

    const outOfStock = items.filter(i => i.status === 'Out of Stock');
    const lowStock = items.filter(i => i.status === 'Low Stock');

    // Sanitize all user-controlled data and limit items
    const itemsHtml = items.slice(0, 100).map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${escapeHtml(String(item.name || ''))}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">
          <span style="
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            ${item.status === 'Out of Stock' 
              ? 'background: #fef2f2; color: #dc2626;' 
              : 'background: #fffbeb; color: #d97706;'}
          ">${escapeHtml(String(item.status || 'Unknown'))}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right; font-weight: 500;">
          ${Number.isFinite(item.quantity) ? item.quantity : 0}
        </td>
      </tr>
    `).join('');

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9fafb;">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #f97316 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🚨 Inventory Alert</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0;">Stock levels need your attention</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <!-- Summary Cards -->
          <div style="display: flex; gap: 15px; margin-bottom: 25px;">
            <div style="flex: 1; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; text-align: center;">
              <p style="font-size: 28px; font-weight: bold; color: #dc2626; margin: 0;">${outOfStock.length}</p>
              <p style="font-size: 12px; color: #991b1b; margin: 5px 0 0;">Out of Stock</p>
            </div>
            <div style="flex: 1; background: #fffbeb; border: 1px solid #fed7aa; border-radius: 8px; padding: 15px; text-align: center;">
              <p style="font-size: 28px; font-weight: bold; color: #d97706; margin: 0;">${lowStock.length}</p>
              <p style="font-size: 12px; color: #92400e; margin: 5px 0 0;">Low Stock</p>
            </div>
          </div>
          
          <h2 style="font-size: 16px; color: #374151; margin: 0 0 15px;">Items Requiring Action</h2>
          
          <table style="width: 100%; border-collapse: collapse; background: #f9fafb; border-radius: 8px; overflow: hidden;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 12px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase;">Product</th>
                <th style="padding: 12px; text-align: center; font-size: 12px; color: #6b7280; text-transform: uppercase;">Status</th>
                <th style="padding: 12px; text-align: right; font-size: 12px; color: #6b7280; text-transform: uppercase;">Qty</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          
          <div style="margin-top: 25px; padding: 15px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px;">
            <p style="margin: 0; font-size: 14px; color: #0369a1;">
              <strong>💡 Tip:</strong> Consider enabling auto-reorder for frequently out-of-stock items to maintain optimal inventory levels.
            </p>
          </div>
          
          <p style="text-align: center; margin-top: 25px;">
            <a href="#" style="display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">View Full Inventory</a>
          </p>
        </div>
        
        <p style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px;">
          This is an automated alert from Retail Pro POS<br>
          ${new Date().toLocaleString()}
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
        subject: `🚨 Inventory Alert: ${outOfStock.length} out of stock, ${lowStock.length} low stock`,
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();

    console.log("Inventory alert sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true, data: emailResult }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-inventory-alert function:", error);
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
