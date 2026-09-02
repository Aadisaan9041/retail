import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RazorpayOrderRequest {
  amount: number; // Amount in smallest currency unit (paise for INR)
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

// ============= AUTHENTICATION =============
async function authenticateRequest(req: Request): Promise<{ user: { id: string } | null; error: string | null }> {
  const authHeader = req.headers.get('Authorization');
  
  if (!authHeader) {
    return { user: null, error: 'Authentication required' };
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return { user: null, error: 'Invalid token' };
  }

  return { user, error: null };
}

// ============= RATE LIMITING =============
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // Max 20 payment requests per minute per user

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const key = `razorpay:${userId}`;
  const record = rateLimitStore.get(key);

  // Clean up expired entries
  if (rateLimitStore.size > 500) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < now) {
        rateLimitStore.delete(k);
      }
    }
  }

  if (!record || record.resetTime < now) {
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count };
}

// ============= INPUT VALIDATION =============
function validateAmount(amount: unknown): { valid: boolean; value: number; error?: string } {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { valid: false, value: 0, error: 'Amount must be a number' };
  }
  if (amount <= 0) {
    return { valid: false, value: 0, error: 'Amount must be positive' };
  }
  if (amount > 10000000) { // Max 1 lakh rupees
    return { valid: false, value: 0, error: 'Amount exceeds maximum limit' };
  }
  return { valid: true, value: amount };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ============= AUTHENTICATE USER =============
    const { user, error: authError } = await authenticateRequest(req);
    
    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(
        JSON.stringify({ success: false, error: authError || 'Authentication required' }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ============= CHECK RATE LIMIT =============
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      console.warn(`Rate limit exceeded for user: ${user.id}`);
      return new Response(
        JSON.stringify({ success: false, error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Prefer credentials configured by Admin → Settings → Integrations.
    // Environment variables remain a safe fallback for deployments that have not migrated yet.
    let razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    let razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    try {
      const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const environment = Deno.env.get("RAZORPAY_ENVIRONMENT") === 'live' ? 'live' : 'test';
      const { data: credential } = await service
        .from('integration_credentials')
        .select('credentials_ciphertext, enabled')
        .eq('provider', 'razorpay')
        .eq('environment', environment)
        .maybeSingle();
      if (credential?.enabled && credential.credentials_ciphertext) {
        const encryptionSecret = Deno.env.get('INTEGRATION_CREDENTIALS_ENCRYPTION_KEY');
        if (encryptionSecret) {
          const [iv64, cipher64] = credential.credentials_ciphertext.split('.');
          const raw = atob(cipher64);
          const ivRaw = atob(iv64);
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(encryptionSecret));
          const key = await crypto.subtle.importKey('raw', digest, { name:'AES-GCM' }, false, ['decrypt']);
          const decrypted = await crypto.subtle.decrypt({ name:'AES-GCM', iv:Uint8Array.from(ivRaw, c=>c.charCodeAt(0)) }, key, Uint8Array.from(raw, c=>c.charCodeAt(0)));
          const parsed = JSON.parse(new TextDecoder().decode(decrypted));
          razorpayKeyId = parsed.keyId;
          razorpayKeySecret = parsed.keySecret;
        }
      }
    } catch (credentialError) {
      console.error('Unable to load admin-configured Razorpay credentials:', credentialError);
    }

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error("Razorpay credentials not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Razorpay not configured. Use Admin → Settings → Integrations." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "create_order";

    console.log(`Razorpay ${action} request from user: ${user.id}`);

    if (action === "create_order") {
      const body: RazorpayOrderRequest = await req.json();
      
      const { amount, currency = "INR", receipt, notes } = body;

      // Validate amount
      const amountValidation = validateAmount(amount);
      if (!amountValidation.valid) {
        return new Response(
          JSON.stringify({ success: false, error: amountValidation.error }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Create Razorpay order
      const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
      
      const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(amountValidation.value * 100), // Convert to paise
          currency,
          receipt: receipt || `order_${Date.now()}`,
          notes: { ...notes, user_id: user.id },
        }),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.text();
        console.error("Razorpay order creation failed:", errorData);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create order" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const order = await orderResponse.json();
      console.log("Razorpay order created:", order.id, "for user:", user.id);

      return new Response(
        JSON.stringify({
          success: true,
          order: {
            id: order.id,
            amount: order.amount,
            currency: order.currency,
            receipt: order.receipt,
          },
          key_id: razorpayKeyId,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (action === "verify_payment") {
      const body: VerifyPaymentRequest = await req.json();
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing payment details" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Verify signature using HMAC SHA256
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(razorpayKeySecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );

      const data = `${razorpay_order_id}|${razorpay_payment_id}`;
      const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
      const expectedSignature = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      // Constant-time comparison
      let isValid = expectedSignature.length === razorpay_signature.length;
      for (let i = 0; i < expectedSignature.length; i++) {
        isValid = isValid && (expectedSignature[i] === razorpay_signature[i]);
      }

      if (!isValid) {
        console.error("Payment signature verification failed for user:", user.id);
        return new Response(
          JSON.stringify({ success: false, error: "Payment verification failed" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log("Payment verified successfully:", razorpay_payment_id, "for user:", user.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Payment verified successfully",
          payment_id: razorpay_payment_id,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (action === "get_payment") {
      const paymentId = url.searchParams.get("payment_id");
      
      if (!paymentId) {
        return new Response(
          JSON.stringify({ success: false, error: "Payment ID required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Validate payment ID format
      if (!/^pay_[a-zA-Z0-9]+$/.test(paymentId)) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid payment ID format" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
      
      const paymentResponse = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
        headers: {
          "Authorization": `Basic ${auth}`,
        },
      });

      if (!paymentResponse.ok) {
        return new Response(
          JSON.stringify({ success: false, error: "Failed to fetch payment" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const payment = await paymentResponse.json();

      console.log("Payment details fetched:", paymentId, "for user:", user.id);

      return new Response(
        JSON.stringify({
          success: true,
          payment: {
            id: payment.id,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            method: payment.method,
            email: payment.email,
            contact: payment.contact,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in razorpay-payment function:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: "An error occurred processing your request" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
