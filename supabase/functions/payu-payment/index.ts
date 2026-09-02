import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAYU_MERCHANT_KEY = Deno.env.get("PAYU_MERCHANT_KEY");
const PAYU_MERCHANT_SALT = Deno.env.get("PAYU_MERCHANT_SALT");
const PAYU_BASE_URL = Deno.env.get("PAYU_TEST_MODE") === "true" 
  ? "https://test.payu.in" 
  : "https://secure.payu.in";

interface PaymentRequest {
  amount: number;
  productInfo: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  transactionId?: string;
  successUrl: string;
  failureUrl: string;
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
  const key = `payu:${userId}`;
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
function validatePaymentRequest(body: unknown): { valid: boolean; data?: PaymentRequest; error?: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' };
  }

  const data = body as Record<string, unknown>;

  // Validate amount
  if (typeof data.amount !== 'number' || isNaN(data.amount) || data.amount <= 0) {
    return { valid: false, error: 'Invalid amount' };
  }
  if (data.amount > 10000000) {
    return { valid: false, error: 'Amount exceeds maximum limit' };
  }

  // Validate required strings
  if (typeof data.productInfo !== 'string' || data.productInfo.length < 1 || data.productInfo.length > 200) {
    return { valid: false, error: 'Invalid product info' };
  }
  if (typeof data.customerName !== 'string' || data.customerName.length < 2 || data.customerName.length > 100) {
    return { valid: false, error: 'Invalid customer name' };
  }
  if (typeof data.customerEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customerEmail)) {
    return { valid: false, error: 'Invalid email' };
  }
  if (typeof data.customerPhone !== 'string' || !/^[\d\s\-+()]{7,20}$/.test(data.customerPhone)) {
    return { valid: false, error: 'Invalid phone number' };
  }

  // Validate URLs
  if (typeof data.successUrl !== 'string' || !data.successUrl.startsWith('http')) {
    return { valid: false, error: 'Invalid success URL' };
  }
  if (typeof data.failureUrl !== 'string' || !data.failureUrl.startsWith('http')) {
    return { valid: false, error: 'Invalid failure URL' };
  }

  // Sanitize inputs
  const sanitize = (str: string, maxLen: number) => str.slice(0, maxLen).replace(/[<>]/g, '').trim();

  return {
    valid: true,
    data: {
      amount: data.amount,
      productInfo: sanitize(data.productInfo as string, 200),
      customerName: sanitize(data.customerName as string, 100),
      customerEmail: sanitize(data.customerEmail as string, 255),
      customerPhone: sanitize(data.customerPhone as string, 20),
      transactionId: data.transactionId ? sanitize(String(data.transactionId), 50) : undefined,
      successUrl: data.successUrl as string,
      failureUrl: data.failureUrl as string,
    }
  };
}

// Generate SHA-512 hash
async function generateHash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-512", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
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

    // ============= VALIDATE INPUT =============
    const body = await req.json();
    const validation = validatePaymentRequest(body);
    
    if (!validation.valid || !validation.data) {
      return new Response(
        JSON.stringify({ success: false, error: validation.error || 'Invalid request' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const {
      amount,
      productInfo,
      customerName,
      customerEmail,
      customerPhone,
      transactionId,
      successUrl,
      failureUrl,
    } = validation.data;

    if (!PAYU_MERCHANT_KEY || !PAYU_MERCHANT_SALT) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "PayU credentials not configured" 
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const txnId = transactionId || `TXN${Date.now()}`;
    const amountStr = amount.toFixed(2);

    // Generate hash: key|txnid|amount|productinfo|firstname|email|||||||||||salt
    const hashString = `${PAYU_MERCHANT_KEY}|${txnId}|${amountStr}|${productInfo}|${customerName}|${customerEmail}|||||||||||${PAYU_MERCHANT_SALT}`;
    const hash = await generateHash(hashString);

    console.log("PayU payment initiated for:", txnId, "by user:", user.id);

    // Return the payment form data
    const paymentData = {
      key: PAYU_MERCHANT_KEY,
      txnid: txnId,
      amount: amountStr,
      productinfo: productInfo,
      firstname: customerName,
      email: customerEmail,
      phone: customerPhone,
      surl: successUrl,
      furl: failureUrl,
      hash: hash,
      action: `${PAYU_BASE_URL}/_payment`,
    };

    return new Response(
      JSON.stringify({ success: true, data: paymentData }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error in payu-payment function:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: "An error occurred processing your request" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
