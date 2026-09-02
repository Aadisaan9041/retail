import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting: 10 tracking attempts per minute per IP
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Input validation
function isValidTrackingNumber(tracking: string): boolean {
  // Format: ORD-XXXXXX (alphanumeric, max 20 chars)
  const trackingRegex = /^[A-Z0-9-]{1,20}$/;
  return trackingRegex.test(tracking);
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

// Sanitize string for logging
function sanitizeForLog(str: string): string {
  return str.replace(/[<>&"']/g, '').substring(0, 50);
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Rate limiting by IP
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const now = Date.now();
    
    let limit = rateLimitStore.get(clientIP);
    if (!limit || limit.resetTime < now) {
      limit = { count: 0, resetTime: now + 60000 }; // 1 minute window
    }
    
    if (limit.count >= 10) {
      console.warn(`Rate limit exceeded for IP: ${sanitizeForLog(clientIP)}`);
      return new Response(
        JSON.stringify({ success: false, error: "Too many requests. Please try again later." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    limit.count++;
    rateLimitStore.set(clientIP, limit);

    // Clean up old rate limit entries periodically
    if (rateLimitStore.size > 1000) {
      for (const [ip, data] of rateLimitStore.entries()) {
        if (data.resetTime < now) {
          rateLimitStore.delete(ip);
        }
      }
    }

    // Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { tracking_number, customer_email } = body;

    // Validate required fields
    if (!tracking_number || !customer_email) {
      return new Response(
        JSON.stringify({ success: false, error: "Tracking number and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate input formats
    const normalizedTracking = String(tracking_number).trim().toUpperCase();
    const normalizedEmail = String(customer_email).trim().toLowerCase();

    if (!isValidTrackingNumber(normalizedTracking)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid tracking number format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isValidEmail(normalizedEmail)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`Order tracking request: ${sanitizeForLog(normalizedTracking)} from IP: ${sanitizeForLog(clientIP)}`);

    // Query order with BOTH tracking number AND email verification
    const { data: order, error: queryError } = await supabase
      .from("orders")
      .select(`
        id,
        tracking_number,
        status,
        customer_name,
        delivery_address,
        delivery_fee,
        estimated_delivery,
        status_history,
        created_at,
        delivery_partners:delivery_partner_id (
          name,
          phone
        )
      `)
      .eq("tracking_number", normalizedTracking)
      .eq("customer_email", normalizedEmail)
      .maybeSingle();

    if (queryError) {
      console.error("Database query error:", queryError.message);
      return new Response(
        JSON.stringify({ success: false, error: "Error fetching order details" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!order) {
      // Generic error to prevent enumeration
      console.log(`Order not found or email mismatch: ${sanitizeForLog(normalizedTracking)}`);
      return new Response(
        JSON.stringify({ success: false, error: "Order not found or email does not match" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Order found: ${order.id}`);

    return new Response(
      JSON.stringify({ success: true, order }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in track-order function:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
