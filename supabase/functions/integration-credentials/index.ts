import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROVIDERS = new Set(['razorpay','payu','meesho','flipkart','amazon','shipping','whatsapp','email']);
const ENVIRONMENTS = new Set(['test','live','production']);

function b64(bytes: Uint8Array) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function fromB64(value: string) {
  const raw = atob(value);
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function getKey() {
  const secret = Deno.env.get('INTEGRATION_CREDENTIALS_ENCRYPTION_KEY');
  if (!secret) throw new Error('INTEGRATION_CREDENTIALS_ENCRYPTION_KEY is not configured');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt','decrypt']);
}

async function encrypt(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getKey();
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return `${b64(iv)}.${b64(new Uint8Array(ciphertext))}`;
}

async function decrypt(value: string) {
  const [iv64, cipher64] = value.split('.');
  if (!iv64 || !cipher64) throw new Error('Invalid credential ciphertext');
  const key = await getKey();
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv64) }, key, fromB64(cipher64));
  return JSON.parse(new TextDecoder().decode(plaintext));
}

async function auth(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('Authentication required');
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const client = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new Error('Invalid authentication');
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: role } = await service.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
  if (!role) throw new Error('Admin privileges required');
  return { user, service };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { user, service } = await auth(req);
    const body = await req.json();
    const action = body.action || 'status';
    const provider = String(body.provider || '');
    const environment = String(body.environment || 'test');
    if (!PROVIDERS.has(provider) || !ENVIRONMENTS.has(environment)) throw new Error('Unsupported provider or environment');

    if (action === 'save') {
      if (!body.credentials || typeof body.credentials !== 'object') throw new Error('Credentials are required');
      let credentials = { ...body.credentials };
      const { data: existing } = await service.from('integration_credentials').select('credentials_ciphertext,metadata').eq('provider', provider).eq('environment', environment).maybeSingle();
      if (existing?.credentials_ciphertext) {
        const previous = await decrypt(existing.credentials_ciphertext);
        for (const [key, value] of Object.entries(previous)) {
          if (typeof value === 'string' && (!credentials[key] || String(credentials[key]).trim() === '')) credentials[key] = value;
        }
      }
      const ciphertext = await encrypt(credentials);
      const metadata = {
        label: body.metadata?.label || provider,
        account: body.metadata?.account || existing?.metadata?.account || '',
        keyHint: typeof credentials.keyId === 'string' ? `${credentials.keyId.slice(0, 6)}…` : '',
      };
      const { error } = await service.from('integration_credentials').upsert({
        provider, environment, credentials_ciphertext: ciphertext, metadata,
        enabled: body.enabled !== false, updated_by: user.id, created_by: user.id,
        last_test_status: 'unknown', last_test_message: null,
      }, { onConflict: 'provider,environment' });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type':'application/json', ...corsHeaders } });
    }

    if (action === 'delete') {
      const { error } = await service.from('integration_credentials').delete().eq('provider', provider).eq('environment', environment);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type':'application/json', ...corsHeaders } });
    }

    if (action === 'test') {
      const { data: row, error } = await service.from('integration_credentials').select('*').eq('provider', provider).eq('environment', environment).maybeSingle();
      if (error) throw error;
      if (!row) throw new Error('Credentials are not configured');
      const credentials = await decrypt(row.credentials_ciphertext);
      let ok = true;
      let message = 'Credentials are stored and decrypt successfully.';
      if (provider === 'razorpay') {
        if (!credentials.keyId || !credentials.keySecret) throw new Error('Razorpay Key ID and Key Secret are required');
        const response = await fetch('https://api.razorpay.com/v1/orders?count=1', {
          headers: { Authorization: `Basic ${btoa(`${credentials.keyId}:${credentials.keySecret}`)}` },
        });
        ok = response.ok;
        if (!ok) message = `Razorpay rejected the credentials (HTTP ${response.status}).`;
        else message = 'Razorpay connection verified.';
      }
      await service.from('integration_credentials').update({ last_tested_at: new Date().toISOString(), last_test_status: ok ? 'success':'failed', last_test_message: message }).eq('id', row.id);
      return new Response(JSON.stringify({ success: ok, message }), { status: ok ? 200 : 400, headers: { 'Content-Type':'application/json', ...corsHeaders } });
    }

    const { data, error } = await service.from('integration_credentials').select('provider,environment,metadata,enabled,last_tested_at,last_test_status,last_test_message,updated_at').eq('provider', provider).eq('environment', environment).maybeSingle();
    if (error) throw error;
    return new Response(JSON.stringify({ success:true, configured:!!data, credential:data ? { ...data, masked:true } : null }), { headers: { 'Content-Type':'application/json', ...corsHeaders } });
  } catch (error) {
    return new Response(JSON.stringify({ success:false, error:error instanceof Error ? error.message : 'Unexpected error' }), { status: 400, headers: { 'Content-Type':'application/json', ...corsHeaders } });
  }
});
