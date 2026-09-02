import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BarcodeLookupRequest {
  barcode: string;
  includeMarketplaceData?: boolean;
  searchSimilar?: boolean;
}

interface MarketplaceProductData {
  source: string;
  name?: string;
  brand?: string;
  description?: string;
  category?: string;
  mrp?: number;
  imageUrl?: string;
  attributes?: Record<string, string>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { barcode, includeMarketplaceData, searchSimilar }: BarcodeLookupRequest = await req.json();

    if (!barcode) {
      return new Response(
        JSON.stringify({ success: false, error: 'Barcode is required' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Looking up barcode: ${barcode}`);

    // First, check if product exists in our database
    let { data: existingProduct, error: productError } = await supabase
      .from('products')
      .select('*, product_variants(*)')
      .or(`barcode.eq.${barcode},sku.eq.${barcode},ean_upc.eq.${barcode}`)
      .maybeSingle();

    // Also check variants
    if (!existingProduct) {
      const { data: variant } = await supabase
        .from('product_variants')
        .select('*, product:products(*)')
        .or(`barcode.eq.${barcode},sku.eq.${barcode}`)
        .maybeSingle();

      if (variant && variant.product) {
        existingProduct = {
          ...variant.product,
          matched_variant: variant,
        };
      }
    }

    if (existingProduct) {
      console.log(`Found existing product: ${existingProduct.name}`);
      return new Response(
        JSON.stringify({
          success: true,
          found: true,
          source: 'local',
          product: existingProduct,
        }),
        { headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // If not found locally and marketplace lookup is requested
    if (includeMarketplaceData) {
      const marketplaceData = await lookupBarcodeInMarketplaces(barcode);
      
      if (marketplaceData) {
        // Use AI to enhance and suggest product details
        let aiSuggestions = null;
        
        if (lovableApiKey) {
          aiSuggestions = await getAIProductSuggestions(lovableApiKey, barcode, marketplaceData);
        }

        return new Response(
          JSON.stringify({
            success: true,
            found: true,
            source: 'marketplace',
            marketplaceData,
            aiSuggestions,
          }),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // If still not found and similar search is requested
    if (searchSimilar) {
      // Try partial matching
      const { data: similarProducts } = await supabase
        .from('products')
        .select('id, name, sku, barcode, price, quantity, image_url')
        .or(`barcode.ilike.%${barcode.slice(-6)}%,sku.ilike.%${barcode.slice(-6)}%`)
        .limit(5);

      if (similarProducts && similarProducts.length > 0) {
        return new Response(
          JSON.stringify({
            success: true,
            found: false,
            similarProducts,
            message: 'Exact match not found, but similar products were found',
          }),
          { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Not found anywhere - use AI to suggest what this product might be
    let aiSuggestions = null;
    if (lovableApiKey) {
      aiSuggestions = await getAIProductSuggestions(lovableApiKey, barcode, null);
    }

    return new Response(
      JSON.stringify({
        success: true,
        found: false,
        barcode,
        aiSuggestions,
        message: 'Product not found. You can add it manually or use AI suggestions.',
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in barcode-product-lookup:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

async function lookupBarcodeInMarketplaces(barcode: string): Promise<MarketplaceProductData | null> {
  console.log(`Looking up barcode ${barcode} in marketplaces...`);

  // In production, this would call actual marketplace APIs
  // Example integrations:
  
  // 1. Open Food Facts API (for FMCG products)
  // const openFoodFactsUrl = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
  
  // 2. UPC Database APIs
  // const upcDatabaseUrl = `https://api.upcdatabase.org/product/${barcode}`;
  
  // 3. Barcode Lookup APIs
  // const barcodeLookupUrl = `https://api.barcodelookup.com/v3/products?barcode=${barcode}&key=API_KEY`;

  // For now, simulate lookup based on barcode format
  const barcodeNum = barcode.replace(/\D/g, '');
  
  if (barcodeNum.length === 13 || barcodeNum.length === 12) {
    // EAN-13 or UPC-A format - likely a real product
    // Country code from first 3 digits
    const countryPrefix = barcodeNum.substring(0, 3);
    const isIndianProduct = countryPrefix >= '890' && countryPrefix <= '899';
    
    return {
      source: 'barcode_format_detection',
      category: 'General',
      attributes: {
        barcode_type: barcodeNum.length === 13 ? 'EAN-13' : 'UPC-A',
        country_prefix: countryPrefix,
        likely_origin: isIndianProduct ? 'India' : 'International',
      },
    };
  }

  return null;
}

async function getAIProductSuggestions(
  apiKey: string,
  barcode: string,
  marketplaceData: MarketplaceProductData | null
): Promise<any> {
  try {
    const prompt = marketplaceData
      ? `Based on this barcode ${barcode} and marketplace data: ${JSON.stringify(marketplaceData)}, suggest appropriate product details for a retail POS system. Include suggested name, category, typical price range, and recommended attributes.`
      : `The barcode ${barcode} was scanned but not found in any database. Based on the barcode format, suggest what type of product this might be and recommend steps to properly add it to inventory. Analyze the barcode structure (${barcode.length} digits, prefix: ${barcode.substring(0, 3)}).`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a retail product specialist helping to identify and catalog products. Provide structured suggestions for adding products to inventory.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', await response.text());
      return null;
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    return {
      suggestions: content,
      barcodeAnalysis: {
        length: barcode.length,
        type: barcode.length === 13 ? 'EAN-13' : barcode.length === 12 ? 'UPC-A' : 'Custom',
        prefix: barcode.substring(0, 3),
      },
    };
  } catch (error) {
    console.error('Error getting AI suggestions:', error);
    return null;
  }
}

serve(handler);
