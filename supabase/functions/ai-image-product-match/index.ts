import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "AI API key not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ success: false, error: "Image data is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Fetch all products from database for matching
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: products, error: dbError } = await supabase
      .from("products")
      .select("id, name, sku, barcode, price, cost, quantity, image_url, category_id, description, brand, color, fabric, pattern, fit_shape, occasion, sleeve_length, neck_type, categories(name)")
      .order("name");

    if (dbError) {
      console.error("DB error:", dbError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch products" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build a compact product catalog for the AI prompt
    const catalog = (products || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: p.price,
      quantity: p.quantity,
      category: p.categories?.name || "Unknown",
      brand: p.brand || "",
      color: p.color || "",
      fabric: p.fabric || "",
      pattern: p.pattern || "",
      description: p.description || "",
    }));

    const systemPrompt = `You are a retail product identification AI. You will receive an image captured from a store's camera. Your task is to analyze the image and identify which product(s) from the store's inventory catalog it matches.

Analyze the image for:
- Product type (clothing, electronics, kitchenware, book, etc.)
- Color(s) visible
- Style, design, pattern
- Any text, brand logos, or labels visible
- Material/fabric if identifiable
- Shape, form factor

Then match against the provided product catalog. Return your response as valid JSON only, with NO markdown formatting, NO code blocks, NO explanation outside the JSON. The JSON must follow this exact structure:

{
  "analysis": {
    "productType": "string describing what you see",
    "colors": ["array of colors detected"],
    "style": "style description",
    "textDetected": "any text/brand visible",
    "material": "material if identifiable",
    "confidence": "high|medium|low"
  },
  "matches": [
    {
      "productId": "uuid from catalog",
      "productName": "name from catalog",
      "sku": "sku from catalog",
      "matchScore": 0.95,
      "matchReason": "why this matches"
    }
  ]
}

Return up to 5 best matches sorted by matchScore (1.0 = perfect match, 0.0 = no match). Only include matches with score >= 0.3. If no products match, return an empty matches array.`;

    const userPrompt = `Here is the store's product catalog:\n${JSON.stringify(catalog, null, 1)}\n\nPlease analyze the attached image and find matching products from this catalog.`;

    // Use Gemini vision model for image analysis
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64.startsWith("data:")
                    ? imageBase64
                    : `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: "AI analysis failed" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";

    // Parse the AI response - strip markdown code blocks if present
    let parsed;
    try {
      const cleaned = content.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", content);
      parsed = { analysis: { productType: "Unknown", confidence: "low" }, matches: [] };
    }

    // Enrich matches with full product data
    const enrichedMatches = (parsed.matches || []).map((match: any) => {
      const fullProduct = (products || []).find((p: any) => p.id === match.productId);
      return {
        ...match,
        product: fullProduct || null,
      };
    });

    return new Response(
      JSON.stringify({
        success: true,
        analysis: parsed.analysis,
        matches: enrichedMatches,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in ai-image-product-match:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
