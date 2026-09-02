import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MarketplaceSyncRequest {
  productId?: string;
  marketplace: 'meesho' | 'amazon' | 'flipkart' | 'all';
  action: 'sync_stock' | 'update_price' | 'get_status';
  data?: {
    quantity?: number;
    price?: number;
    sku?: string;
  };
}

interface MarketplaceConfig {
  name: string;
  apiEndpoint: string;
  requiresAuth: boolean;
  stockUpdateEndpoint: string;
  priceUpdateEndpoint: string;
}

const MARKETPLACE_CONFIGS: Record<string, MarketplaceConfig> = {
  meesho: {
    name: 'Meesho',
    apiEndpoint: 'https://api.meesho.com/v1/seller',
    requiresAuth: true,
    stockUpdateEndpoint: '/inventory/update',
    priceUpdateEndpoint: '/price/update',
  },
  amazon: {
    name: 'Amazon',
    apiEndpoint: 'https://sellercentral.amazon.in/api',
    requiresAuth: true,
    stockUpdateEndpoint: '/inventory',
    priceUpdateEndpoint: '/pricing',
  },
  flipkart: {
    name: 'Flipkart',
    apiEndpoint: 'https://api.flipkart.net/sellers/v3',
    requiresAuth: true,
    stockUpdateEndpoint: '/inventory',
    priceUpdateEndpoint: '/listings/price',
  },
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { productId, marketplace, action, data }: MarketplaceSyncRequest = await req.json();

    console.log(`Marketplace sync request: ${action} for ${marketplace}`, { productId, data });

    // Marketplace credentials are now stored encrypted by Admin → Settings → Integrations.
    const encryptionSecret = Deno.env.get('INTEGRATION_CREDENTIALS_ENCRYPTION_KEY');
    const environment = Deno.env.get('MARKETPLACE_ENVIRONMENT') === 'live' ? 'live' : 'test';
    const credentialRows = await supabase.from('integration_credentials')
      .select('provider, credentials_ciphertext, enabled')
      .in('provider', ['meesho','amazon','flipkart'])
      .eq('environment', environment);

    const credentialsMap: Record<string, any> = {};
    for (const row of credentialRows.data || []) {
      if (!row.enabled || !row.credentials_ciphertext || !encryptionSecret) continue;
      try {
        const [iv64, cipher64] = row.credentials_ciphertext.split('.');
        const ivRaw = atob(iv64); const cipherRaw = atob(cipher64);
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(encryptionSecret));
        const key = await crypto.subtle.importKey('raw', digest, { name:'AES-GCM' }, false, ['decrypt']);
        const decrypted = await crypto.subtle.decrypt({ name:'AES-GCM', iv:Uint8Array.from(ivRaw,c=>c.charCodeAt(0)) }, key, Uint8Array.from(cipherRaw,c=>c.charCodeAt(0)));
        credentialsMap[row.provider] = JSON.parse(new TextDecoder().decode(decrypted));
      } catch (e) { console.error(`Unable to decrypt ${row.provider} credentials`, e); }
    }

    let products: any[] = [];
    
    if (productId) {
      const { data: product, error } = await supabase
        .from('products')
        .select('*, product_variants(*)')
        .eq('id', productId)
        .single();
      
      if (error || !product) {
        return new Response(
          JSON.stringify({ success: false, error: 'Product not found' }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      products = [product];
    } else {
      // Get all products for bulk sync
      const { data: allProducts } = await supabase
        .from('products')
        .select('*, product_variants(*)')
        .order('updated_at', { ascending: false });
      products = allProducts || [];
    }

    const results: any[] = [];
    const marketplacesToSync = marketplace === 'all' 
      ? ['meesho', 'amazon', 'flipkart'] 
      : [marketplace];

    for (const mp of marketplacesToSync) {
      const config = MARKETPLACE_CONFIGS[mp];
      const apiKey = credentialsMap[mp]?.apiKey || credentialsMap[mp]?.applicationSecret || credentialsMap[mp]?.refreshToken;

      if (!apiKey) {
        results.push({
          marketplace: mp,
          success: false,
          error: `API key not configured for ${config.name}`,
        });
        continue;
      }

      for (const product of products) {
        try {
          let syncResult;

          switch (action) {
            case 'sync_stock':
              // Calculate total stock including variants
              const totalStock = product.product_variants?.length > 0
                ? product.product_variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0)
                : product.quantity;

              syncResult = await simulateMarketplaceApiCall(mp, config, apiKey, {
                action: 'stock_update',
                sku: product.sku,
                style_id: product.style_id,
                quantity: data?.quantity ?? totalStock,
                variants: product.product_variants?.map((v: any) => ({
                  sku: v.sku,
                  quantity: v.quantity,
                  size: v.variation,
                  color: v.color,
                })),
              });
              break;

            case 'update_price':
              syncResult = await simulateMarketplaceApiCall(mp, config, apiKey, {
                action: 'price_update',
                sku: product.sku,
                price: data?.price ?? product.price,
                mrp: product.mrp,
                variants: product.product_variants?.map((v: any) => ({
                  sku: v.sku,
                  price: v.meesho_price || v.price,
                  mrp: v.mrp,
                })),
              });
              break;

            case 'get_status':
              syncResult = await simulateMarketplaceApiCall(mp, config, apiKey, {
                action: 'get_status',
                sku: product.sku,
              });
              break;

            default:
              syncResult = { success: false, error: 'Unknown action' };
          }

          results.push({
            marketplace: mp,
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            ...syncResult,
          });

          // Log sync activity
          await supabase.from('app_settings').upsert({
            key: `last_${mp}_sync`,
            value: {
              timestamp: new Date().toISOString(),
              productCount: products.length,
              action,
            },
          }, { onConflict: 'key' });

        } catch (error: any) {
          console.error(`Error syncing product ${product.id} to ${mp}:`, error);
          results.push({
            marketplace: mp,
            productId: product.id,
            productName: product.name,
            success: false,
            error: error.message,
          });
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return new Response(
      JSON.stringify({
        success: failCount === 0,
        summary: {
          total: results.length,
          successful: successCount,
          failed: failCount,
        },
        results,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in marketplace-inventory-sync:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

// Simulates marketplace API calls - in production, replace with real API integrations
async function simulateMarketplaceApiCall(
  marketplace: string,
  config: MarketplaceConfig,
  apiKey: string,
  payload: any
): Promise<{ success: boolean; message?: string; error?: string; data?: any }> {
  console.log(`[${marketplace}] API call simulation:`, payload);

  // Simulate API latency
  await new Promise(resolve => setTimeout(resolve, 100));

  // In production, this would make actual HTTP calls to marketplace APIs
  // Example for Meesho:
  // const response = await fetch(`${config.apiEndpoint}${config.stockUpdateEndpoint}`, {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${apiKey}`,
  //     'Content-Type': 'application/json',
  //   },
  //   body: JSON.stringify(payload),
  // });

  // For now, return simulated success
  return {
    success: true,
    message: `${payload.action} completed successfully for ${marketplace}`,
    data: {
      marketplace,
      sku: payload.sku,
      timestamp: new Date().toISOString(),
      action: payload.action,
      details: payload,
    },
  };
}

serve(handler);
