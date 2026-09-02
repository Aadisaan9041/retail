import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-csrf-token, x-razorpay-signature, x-payu-hash',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ============= WEBHOOK SIGNATURE VERIFICATION =============

/**
 * Verify Razorpay webhook signature using HMAC-SHA256
 * @param body - Raw request body string
 * @param signature - Signature from x-razorpay-signature header
 * @param secret - Razorpay webhook secret
 * @returns Promise<boolean>
 */
async function verifyRazorpaySignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    if (!signature || !secret) return false;
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    // Constant-time comparison to prevent timing attacks
    return constantTimeCompare(signature.toLowerCase(), expectedSignature.toLowerCase());
  } catch (error) {
    console.error('Razorpay signature verification error:', error);
    return false;
  }
}

/**
 * Verify PayU response hash using SHA-512
 * PayU response hash format: salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
 * @param params - PayU callback parameters
 * @param salt - PayU merchant salt
 * @returns Promise<boolean>
 */
async function verifyPayUSignature(
  params: Record<string, string>,
  salt: string
): Promise<boolean> {
  try {
    if (!params.hash || !salt) return false;

    // PayU response hash string (reverse of request hash)
    const hashString = [
      salt,
      params.status || '',
      '', '', '', '', '', // empty fields in PayU format
      params.udf5 || '',
      params.udf4 || '',
      params.udf3 || '',
      params.udf2 || '',
      params.udf1 || '',
      params.email || '',
      params.firstname || '',
      params.productinfo || '',
      params.amount || '',
      params.txnid || '',
      params.key || '',
    ].join('|');

    const encoder = new TextEncoder();
    const data = encoder.encode(hashString);
    const hashBuffer = await crypto.subtle.digest('SHA-512', data);
    const expectedHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return constantTimeCompare(params.hash.toLowerCase(), expectedHash.toLowerCase());
  } catch (error) {
    console.error('PayU signature verification error:', error);
    return false;
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ============= RATE LIMITING =============
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 10; // Max 10 requests per minute per IP
const RATE_LIMIT_CHECKOUT_MAX = 3; // Max 3 successful checkouts per minute per IP

function getClientIP(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = req.headers.get('x-real-ip');
  if (realIP) return realIP;
  
  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  if (cfConnectingIP) return cfConnectingIP;
  
  const userAgent = req.headers.get('user-agent') || 'unknown';
  return `ua-${hashString(userAgent)}`;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
}

function checkRateLimit(clientIP: string, limit: number = RATE_LIMIT_MAX_REQUESTS): RateLimitResult {
  const now = Date.now();
  const key = `checkout:${clientIP}`;
  const record = rateLimitStore.get(key);
  
  // Clean up expired entries periodically
  if (rateLimitStore.size > 1000) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < now) {
        rateLimitStore.delete(k);
      }
    }
  }
  
  if (!record || record.resetTime < now) {
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: limit - 1, resetIn: RATE_LIMIT_WINDOW_MS };
  }
  
  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetIn: record.resetTime - now };
  }
  
  record.count++;
  return { allowed: true, remaining: limit - record.count, resetIn: record.resetTime - now };
}

// ============= INPUT VALIDATION =============

interface CartItemInput {
  product_id: string;
  quantity: number;
}

interface CustomerInfoInput {
  name: string;
  email?: string;
  phone?: string;
  address: string;
}

interface CheckoutInput {
  items: CartItemInput[];
  customer: CustomerInfoInput;
  delivery_partner_id?: string;
  payment_method: 'card' | 'upi' | 'wallet';
  csrf_token?: string;
}

interface WebhookPayload {
  type: 'razorpay' | 'payu';
  event?: string;
  payload?: Record<string, unknown>;
}

function sanitizeString(input: string, maxLength: number = 500): string {
  if (typeof input !== 'string') return '';
  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\d\s\-+()]{7,20}$/;
  return phoneRegex.test(phone);
}

function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

function generateTrackingNumber(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'ORD-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function validateCheckoutInput(input: unknown): { valid: true; data: CheckoutInput } | { valid: false; error: string } {
  if (!input || typeof input !== 'object') {
    return { valid: false, error: 'Invalid input format' };
  }

  const data = input as Record<string, unknown>;

  if (!Array.isArray(data.items) || data.items.length === 0) {
    return { valid: false, error: 'Cart items are required' };
  }

  if (data.items.length > 100) {
    return { valid: false, error: 'Too many items in cart (max 100)' };
  }

  const sanitizedItems: CartItemInput[] = [];
  for (const item of data.items) {
    if (!item || typeof item !== 'object') {
      return { valid: false, error: 'Invalid cart item format' };
    }

    const cartItem = item as Record<string, unknown>;
    
    if (typeof cartItem.product_id !== 'string' || !isValidUUID(cartItem.product_id)) {
      return { valid: false, error: 'Invalid product ID format' };
    }

    if (typeof cartItem.quantity !== 'number' || cartItem.quantity < 1 || cartItem.quantity > 1000) {
      return { valid: false, error: 'Invalid quantity (must be 1-1000)' };
    }

    sanitizedItems.push({
      product_id: cartItem.product_id,
      quantity: Math.floor(cartItem.quantity),
    });
  }

  if (!data.customer || typeof data.customer !== 'object') {
    return { valid: false, error: 'Customer information is required' };
  }

  const customer = data.customer as Record<string, unknown>;

  if (typeof customer.name !== 'string' || customer.name.length < 2) {
    return { valid: false, error: 'Customer name is required (min 2 characters)' };
  }

  if (typeof customer.address !== 'string' || customer.address.length < 10) {
    return { valid: false, error: 'Delivery address is required (min 10 characters)' };
  }

  const sanitizedCustomer: CustomerInfoInput = {
    name: sanitizeString(customer.name, 100),
    address: sanitizeString(customer.address, 500),
  };

  if (customer.email) {
    if (typeof customer.email !== 'string' || !isValidEmail(customer.email)) {
      return { valid: false, error: 'Invalid email format' };
    }
    sanitizedCustomer.email = sanitizeString(customer.email, 255);
  }

  if (customer.phone) {
    if (typeof customer.phone !== 'string' || !isValidPhone(customer.phone)) {
      return { valid: false, error: 'Invalid phone format' };
    }
    sanitizedCustomer.phone = sanitizeString(customer.phone, 20);
  }

  let deliveryPartnerId: string | undefined;
  if (data.delivery_partner_id) {
    if (typeof data.delivery_partner_id !== 'string' || !isValidUUID(data.delivery_partner_id)) {
      return { valid: false, error: 'Invalid delivery partner ID' };
    }
    deliveryPartnerId = data.delivery_partner_id;
  }

  const validPaymentMethods = ['card', 'upi', 'wallet'];
  if (typeof data.payment_method !== 'string' || !validPaymentMethods.includes(data.payment_method)) {
    return { valid: false, error: 'Invalid payment method' };
  }

  return {
    valid: true,
    data: {
      items: sanitizedItems,
      customer: sanitizedCustomer,
      delivery_partner_id: deliveryPartnerId,
      payment_method: data.payment_method as 'card' | 'upi' | 'wallet',
    },
  };
}

// ============= WEBHOOK HANDLER =============

// deno-lint-ignore no-explicit-any
async function handleWebhook(req: Request, supabase: any): Promise<Response> {
  const razorpaySignature = req.headers.get('x-razorpay-signature');
  const rawBody = await req.text();
  
  // Check if this is a Razorpay webhook
  if (razorpaySignature) {
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || Deno.env.get('RAZORPAY_KEY_SECRET');
    
    if (!webhookSecret) {
      console.error('Razorpay webhook secret not configured');
      return new Response(JSON.stringify({ error: 'Webhook secret not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isValid = await verifyRazorpaySignature(rawBody, razorpaySignature, webhookSecret);
    if (!isValid) {
      console.error('Invalid Razorpay webhook signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const payload = JSON.parse(rawBody);
      console.log('Razorpay webhook event:', payload.event);

      // Handle payment events
      if (payload.event === 'payment.captured' || payload.event === 'payment.authorized') {
        const orderId = payload.payload?.payment?.entity?.order_id;
        const paymentId = payload.payload?.payment?.entity?.id;
        
        if (orderId) {
          // Update order status based on payment success
          const { error } = await supabase
            .from('orders')
            .update({
              status: 'confirmed',
              updated_at: new Date().toISOString(),
            } as Record<string, unknown>)
            .eq('tracking_number', orderId);

          if (error) {
            console.error('Error updating order:', error);
          } else {
            console.log(`Order ${orderId} confirmed via Razorpay payment ${paymentId}`);
          }
        }
      } else if (payload.event === 'payment.failed') {
        const orderId = payload.payload?.payment?.entity?.order_id;
        if (orderId) {
          await supabase
            .from('orders')
            .update({
              status: 'cancelled',
              updated_at: new Date().toISOString(),
            } as Record<string, unknown>)
            .eq('tracking_number', orderId);
          console.log(`Order ${orderId} cancelled due to payment failure`);
        }
      }

      return new Response(JSON.stringify({ success: true, event: payload.event }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (parseError) {
      console.error('Error parsing Razorpay webhook:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // Check if this is a PayU callback (form-encoded)
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const payuSalt = Deno.env.get('PAYU_MERCHANT_SALT');
    
    if (!payuSalt) {
      console.error('PayU salt not configured');
      return new Response(JSON.stringify({ error: 'PayU salt not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const formData = new URLSearchParams(rawBody);
      const params: Record<string, string> = {};
      for (const [key, value] of formData.entries()) {
        params[key] = value;
      }

      const isValid = await verifyPayUSignature(params, payuSalt);
      if (!isValid) {
        console.error('Invalid PayU signature');
        return new Response(JSON.stringify({ error: 'Invalid PayU signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('PayU webhook received, status:', params.status, 'txnid:', params.txnid);

      // Update order based on PayU status
      if (params.status === 'success' && params.txnid) {
        const { error } = await supabase
          .from('orders')
          .update({
            status: 'confirmed',
            updated_at: new Date().toISOString(),
          } as Record<string, unknown>)
          .eq('tracking_number', params.txnid);

        if (error) {
          console.error('Error updating order:', error);
        } else {
          console.log(`Order ${params.txnid} confirmed via PayU`);
        }
      } else if (params.status === 'failure' && params.txnid) {
        await supabase
          .from('orders')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          } as Record<string, unknown>)
          .eq('tracking_number', params.txnid);
        console.log(`Order ${params.txnid} cancelled due to PayU payment failure`);
      }

      return new Response(JSON.stringify({ success: true, status: params.status }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (parseError) {
      console.error('Error parsing PayU callback:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid callback data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  // Not a recognized webhook, return error
  return new Response(JSON.stringify({ error: 'Unrecognized webhook format' }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============= MAIN HANDLER =============

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check if this is a webhook callback (has signature header or form-encoded)
  const razorpaySignature = req.headers.get('x-razorpay-signature');
  const contentType = req.headers.get('content-type') || '';
  const isWebhook = razorpaySignature || 
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data');

  if (isWebhook) {
    return handleWebhook(req, supabase);
  }

  // Regular checkout flow
  const clientIP = getClientIP(req);
  console.log(`Checkout request from IP: ${clientIP}`);
  
  const rateLimit = checkRateLimit(clientIP, RATE_LIMIT_MAX_REQUESTS);
  if (!rateLimit.allowed) {
    console.log(`Rate limit exceeded for IP: ${clientIP}`);
    return new Response(JSON.stringify({ 
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(rateLimit.resetIn / 1000),
    }), {
      status: 429,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000)),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetIn / 1000)),
      },
    });
  }

  try {
    let rawInput: unknown;
    try {
      rawInput = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validation = validateCheckoutInput(rawInput);
    if (!validation.valid) {
      console.log('Validation failed:', validation.error);
      return new Response(JSON.stringify({ error: validation.error }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { items, customer, delivery_partner_id, payment_method } = validation.data;
    console.log(`Processing checkout for ${customer.name} with ${items.length} items`);

    // Fetch products and verify stock
    const productIds = items.map(item => item.product_id);
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, quantity')
      .in('id', productIds);

    if (productsError || !products) {
      console.error('Error fetching products:', productsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch products' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify all products exist and have sufficient stock
    const productMap = new Map(products.map(p => [p.id, p]));
    let subtotal = 0;
    const transactionItems: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      total_price: number;
    }> = [];

    for (const item of items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        return new Response(JSON.stringify({ error: `Product not found: ${item.product_id}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (product.quantity < item.quantity) {
        return new Response(JSON.stringify({ 
          error: `Insufficient stock for ${product.name}. Available: ${product.quantity}` 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const itemTotal = product.price * item.quantity;
      subtotal += itemTotal;

      transactionItems.push({
        product_id: item.product_id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: product.price,
        total_price: itemTotal,
      });
    }

    // Fetch delivery partner fee if provided
    let deliveryFee = 0;
    let estimatedDelivery: string | null = null;
    
    if (delivery_partner_id) {
      const { data: partner, error: partnerError } = await supabase
        .from('delivery_partners')
        .select('delivery_fee, estimated_delivery_time')
        .eq('id', delivery_partner_id)
        .eq('is_active', true)
        .single();

      if (partnerError || !partner) {
        return new Response(JSON.stringify({ error: 'Invalid or inactive delivery partner' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      deliveryFee = partner.delivery_fee || 0;
      estimatedDelivery = partner.estimated_delivery_time;
    }

    // Calculate totals
    const taxRate = 0.18; // 18% GST
    const tax = subtotal * taxRate;
    const total = subtotal + tax + deliveryFee;

    // Create transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        subtotal,
        tax,
        discount: 0,
        total: total - deliveryFee,
        payment_method: payment_method === 'upi' ? 'other' : payment_method,
        status: 'completed',
        loyalty_points_earned: Math.floor(total),
      })
      .select()
      .single();

    if (transactionError || !transaction) {
      console.error('Error creating transaction:', transactionError);
      return new Response(JSON.stringify({ error: 'Failed to create transaction' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert transaction items
    const itemsWithTransactionId = transactionItems.map(item => ({
      ...item,
      transaction_id: transaction.id,
    }));

    const { error: itemsError } = await supabase
      .from('transaction_items')
      .insert(itemsWithTransactionId);

    if (itemsError) {
      console.error('Error creating transaction items:', itemsError);
    }

    // Create order with tracking number
    const trackingNumber = generateTrackingNumber();
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        transaction_id: transaction.id,
        customer_name: customer.name,
        customer_email: customer.email || null,
        customer_phone: customer.phone || null,
        delivery_address: customer.address,
        delivery_partner_id: delivery_partner_id || null,
        delivery_fee: deliveryFee,
        tracking_number: trackingNumber,
        status: 'pending',
        estimated_delivery: estimatedDelivery,
        status_history: [{
          status: 'pending',
          timestamp: new Date().toISOString(),
          message: 'Order placed successfully',
        }],
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
    }

    // Send order confirmation notification
    if (customer.email) {
      try {
        await supabase.functions.invoke('send-order-notification', {
          body: {
            order_id: order?.id,
            tracking_number: trackingNumber,
            customer_email: customer.email,
            customer_name: customer.name,
            status: 'pending',
            message: 'Your order has been placed successfully!',
          },
        });
      } catch (notifyError) {
        console.error('Failed to send order notification:', notifyError);
      }
    }

    console.log(`Checkout completed: Transaction ${transaction.id}, Order ${trackingNumber}`);

    return new Response(JSON.stringify({
      success: true,
      transaction_id: transaction.id,
      order_id: order?.id,
      tracking_number: trackingNumber,
      totals: {
        subtotal,
        tax,
        delivery_fee: deliveryFee,
        total,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Checkout error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Checkout failed';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
