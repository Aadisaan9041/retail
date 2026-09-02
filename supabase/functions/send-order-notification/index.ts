import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const STATUS_MESSAGES: Record<string, { subject: string; emoji: string }> = {
  pending: { subject: 'Order Received', emoji: '📋' },
  confirmed: { subject: 'Order Confirmed', emoji: '✅' },
  processing: { subject: 'Order Being Processed', emoji: '📦' },
  shipped: { subject: 'Order Shipped', emoji: '🚚' },
  out_for_delivery: { subject: 'Order Out for Delivery', emoji: '🏃' },
  delivered: { subject: 'Order Delivered', emoji: '🎉' },
  cancelled: { subject: 'Order Cancelled', emoji: '❌' },
};

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

// Validate tracking number format
function isValidTrackingNumber(tracking: string): boolean {
  return /^[A-Z0-9-]{6,30}$/i.test(tracking);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
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

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.log('RESEND_API_KEY not configured, skipping notification');
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { order_id, tracking_number, customer_email, customer_name, status, message } = await req.json();

    // Validate required fields
    if (!customer_email || !tracking_number) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate email format
    if (!isValidEmail(customer_email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate tracking number
    if (!isValidTrackingNumber(tracking_number)) {
      return new Response(JSON.stringify({ error: 'Invalid tracking number format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate status
    const validStatuses = Object.keys(STATUS_MESSAGES);
    if (status && !validStatuses.includes(status)) {
      return new Response(JSON.stringify({ error: 'Invalid status' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the order exists in database (prevents sending notifications for fake orders)
    const { data: orderExists } = await supabase
      .from('orders')
      .select('id')
      .eq('tracking_number', tracking_number)
      .single();

    if (!orderExists) {
      console.error('Order not found for tracking number:', tracking_number);
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Sending order notification for ${tracking_number} to ${customer_email} by staff user: ${user.id}`);

    const statusInfo = STATUS_MESSAGES[status] || { subject: 'Order Update', emoji: '📬' };
    
    // Sanitize all user-controlled data
    const safeCustomerName = escapeHtml(customer_name || 'Customer');
    const safeTrackingNumber = escapeHtml(tracking_number);
    const safeMessage = message ? escapeHtml(String(message).substring(0, 500)) : statusInfo.subject;
    
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusInfo.subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px;">${statusInfo.emoji} ${statusInfo.subject}</h1>
    </div>
    
    <div style="padding: 30px;">
      <p style="font-size: 16px; color: #374151; margin-bottom: 20px;">
        Hi <strong>${safeCustomerName}</strong>,
      </p>
      
      <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">Tracking Number</p>
        <p style="margin: 0; font-size: 24px; font-weight: bold; color: #111827; font-family: monospace;">${safeTrackingNumber}</p>
      </div>
      
      <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; color: #92400e; font-size: 14px;">
          <strong>Status Update:</strong> ${safeMessage}
        </p>
      </div>
      
      <p style="font-size: 14px; color: #6b7280; margin-bottom: 20px;">
        You can track your order anytime by visiting our order tracking page and entering your tracking number.
      </p>
      
      <div style="text-align: center; margin-top: 30px;">
        <a href="${Deno.env.get('SITE_URL') || ''}/track-order" 
           style="display: inline-block; background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600;">
          Track Your Order
        </a>
      </div>
    </div>
    
    <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        This is an automated message. Please do not reply to this email.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Orders <orders@notification.lovable.app>',
        to: [customer_email],
        subject: `${statusInfo.emoji} ${statusInfo.subject} - ${safeTrackingNumber}`,
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resend API error:', errorText);
      throw new Error(`Failed to send email: ${response.status}`);
    }

    const result = await response.json();
    console.log(`Order notification sent for ${tracking_number} to ${customer_email}`);

    return new Response(JSON.stringify({ success: true, messageId: result.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
