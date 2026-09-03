import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Marketplace = 'meesho' | 'amazon' | 'flipkart';
type Action = 'sync_stock' | 'update_price' | 'get_status';

interface MarketplaceSyncRequest {
  productId?: string;
  marketplace: Marketplace | 'all';
  action: Action;
  data?: { quantity?: number; price?: number; sku?: string };
}

async function requireStaff(req: Request, supabaseUrl: string, anonKey: string, serviceKey: string) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Authentication required');
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) throw new Error('Invalid authentication');
  const service = createClient(supabaseUrl, serviceKey);
  const { data: role } = await service.from('user_roles').select('role').eq('user_id', user.id).in('role', ['admin', 'manager']).maybeSingle();
  if (!role) throw new Error('Admin or manager privileges required');
  return { user, service };
}

async function decryptCredentials(ciphertext: string, secret: string) {
  const [iv64, cipher64] = ciphertext.split('.');
  if (!iv64 || !cipher64) throw new Error('Invalid credential ciphertext');
  const raw = (v: string) => Uint8Array.from(atob(v), c => c.charCodeAt(0));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  const key = await crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw(iv64) }, key, raw(cipher64));
  return JSON.parse(new TextDecoder().decode(plaintext)) as Record<string, unknown>;
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

async function loadCredentials(service: ReturnType<typeof createClient>, environment: string, secret: string) {
  const { data, error } = await service.from('integration_credentials')
    .select('provider,credentials_ciphertext,enabled')
    .in('provider', ['meesho', 'amazon', 'flipkart'])
    .eq('environment', environment);
  if (error) throw error;
  const result: Record<string, Record<string, unknown>> = {};
  for (const row of data || []) {
    if (row.enabled && row.credentials_ciphertext) result[row.provider] = await decryptCredentials(row.credentials_ciphertext, secret);
  }
  return result;
}

/**
 * This function deliberately does not fake marketplace success.
 * Amazon LWA credentials can be validated here, but stock/price writes require
 * the seller's approved SP-API roles and a complete SP-API signing/connector setup.
 * Flipkart and Meesho require their current seller-specific API contracts.
 */
async function testAmazonLwa(credentials: Record<string, unknown>) {
  const refreshToken = String(credentials.refreshToken || '');
  const clientId = String(credentials.clientId || '');
  const clientSecret = String(credentials.clientSecret || '');
  if (!refreshToken || !clientId || !clientSecret) throw new Error('Amazon LWA client ID, client secret and refresh token are required');
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret });
  const r = await fetch('https://api.amazon.com/auth/o2/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body });
  const payload = await r.json().catch(() => ({}));
  if (!r.ok || !payload.access_token) throw new Error(`Amazon LWA rejected the credentials (HTTP ${r.status}).`);
  return { success: true, message: 'Amazon LWA credentials verified. SP-API listing/inventory permissions still need a real seller-authorized API call.' };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const encryptionSecret = Deno.env.get('INTEGRATION_CREDENTIALS_ENCRYPTION_KEY') ?? '';
    if (!encryptionSecret) return response({ success: false, error: 'INTEGRATION_CREDENTIALS_ENCRYPTION_KEY is not configured.' }, 500);

    const { service } = await requireStaff(req, supabaseUrl, anonKey, serviceKey);
    const body = await req.json() as MarketplaceSyncRequest;
    if (!body.marketplace || !body.action) return response({ success: false, error: 'marketplace and action are required' }, 400);

    const environment = Deno.env.get('MARKETPLACE_ENVIRONMENT') === 'live' ? 'live' : 'test';
    const credentials = await loadCredentials(service, environment, encryptionSecret);
    const marketplaces: Marketplace[] = body.marketplace === 'all' ? ['meesho', 'amazon', 'flipkart'] : [body.marketplace];

    if (body.action === 'get_status') {
      const results = [];
      for (const mp of marketplaces) {
        if (!credentials[mp]) results.push({ marketplace: mp, success: false, error: `${mp} is not configured in Admin → Settings → Integrations.` });
        else if (mp === 'amazon') results.push({ marketplace: mp, ...(await testAmazonLwa(credentials[mp])) });
        else results.push({ marketplace: mp, success: false, error: `${mp} credentials are stored, but its current seller API contract has not been supplied/configured. The system will not report a fake sync.` });
      }
      const failed = results.filter(r => !r.success).length;
      return response({ success: failed === 0, summary: { total: results.length, successful: results.length - failed, failed }, results });
    }

    // Product/price/stock writes are intentionally blocked until a real connector is available.
    // This prevents the previous implementation from falsely reporting inventory updates.
    const productsQuery = body.productId
      ? service.from('products').select('id,name,sku,quantity,price,mrp,product_variants(*)').eq('id', body.productId).single()
      : service.from('products').select('id,name,sku,quantity,price,mrp,product_variants(*)').order('updated_at', { ascending: false });
    const { data: products, error: productsError } = body.productId ? await productsQuery : await productsQuery;
    if (productsError) return response({ success: false, error: productsError.message }, 400);
    const list = body.productId ? [products] : (products || []);

    const results = marketplaces.flatMap(mp => list.map((product: any) => ({
      marketplace: mp,
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      success: false,
      error: mp === 'amazon'
        ? 'Amazon credentials can be tested, but inventory/price writes require the approved SP-API connector and seller authorization. No write was attempted.'
        : `${mp} inventory/price connector is not configured. No write was attempted.`,
    })));

    return response({
      success: false,
      summary: { total: results.length, successful: 0, failed: results.length },
      results,
      message: 'No marketplace write was simulated. Configure the approved marketplace connector before enabling live synchronization.',
    }, 409);
  } catch (error) {
    console.error('Marketplace sync error:', error);
    return response({ success: false, error: error instanceof Error ? error.message : 'Unexpected error' }, 400);
  }
};

serve(handler);
