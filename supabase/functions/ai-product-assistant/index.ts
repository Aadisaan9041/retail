 import "https://deno.land/x/xhr@0.1.0/mod.ts";
 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
     const { action, productName, category, existingData } = await req.json();
 
     // Build the prompt based on the action
     let systemPrompt = "";
     let userPrompt = "";
 
     if (action === "generate_details") {
       systemPrompt = `You are an expert e-commerce product listing specialist familiar with Meesho, Amazon, and Flipkart marketplace requirements. Generate comprehensive product details that are compatible with all three platforms.
 
 IMPORTANT: Return ONLY valid JSON without any markdown code blocks or additional text.
 
 The JSON should follow this exact structure:
 {
   "name": "Product title (max 200 chars, keyword-rich)",
   "description": "Detailed product description (150-300 words)",
   "brand": "Brand name",
   "generic_name": "Generic product name (e.g., T-Shirt, Kurta, Shoes)",
   "color": "Primary color",
   "fabric": "Material/Fabric type",
   "pattern": "Pattern type (Solid, Printed, etc.)",
   "fit_shape": "Fit type (Regular, Slim, Loose, etc.)",
   "occasion": "Occasion (Casual, Formal, Party, etc.)",
   "sleeve_length": "Sleeve length if applicable",
   "neck_type": "Neck type if applicable",
   "hemline": "Hemline style if applicable",
   "length_type": "Length type (Regular, Crop, Longline, etc.)",
   "print_pattern_type": "Specific print pattern",
   "sleeve_styling": "Sleeve styling details",
   "net_weight_grams": 200,
   "suggested_mrp": 999,
   "suggested_price": 599,
   "suggested_variants": ["S", "M", "L", "XL", "XXL"],
   "keywords": ["keyword1", "keyword2", "keyword3"],
   "marketplace_tips": {
     "meesho": "Specific tip for Meesho listing",
     "amazon": "Specific tip for Amazon listing",
     "flipkart": "Specific tip for Flipkart listing"
   }
 }`;
 
       userPrompt = `Generate complete product details for: "${productName}"
 Category: ${category || "Not specified"}
 ${existingData ? `Existing data to enhance: ${JSON.stringify(existingData)}` : ""}
 
 Make the listing SEO-optimized and marketplace-compliant.`;
     } else if (action === "enhance_description") {
       systemPrompt = `You are an e-commerce copywriting expert. Enhance product descriptions to be more compelling and SEO-friendly for Meesho, Amazon, and Flipkart.
 
 IMPORTANT: Return ONLY the enhanced description text, no JSON or markdown.`;
 
       userPrompt = `Enhance this product description for "${productName}":
 ${existingData?.description || "No description provided"}
 
 Make it:
 1. More compelling and benefit-focused
 2. Include relevant keywords naturally
 3. Highlight key features and benefits
 4. Be 150-300 words
 5. Include bullet points for features`;
     } else if (action === "suggest_pricing") {
       systemPrompt = `You are an e-commerce pricing expert. Suggest optimal pricing for marketplace listings.
 
 IMPORTANT: Return ONLY valid JSON:
 {
   "mrp": 999,
   "selling_price": 599,
   "meesho_price": 549,
   "wrong_defective_price": 499,
   "reasoning": "Brief explanation of pricing strategy"
 }`;
 
       userPrompt = `Suggest pricing for: "${productName}"
 Category: ${category || "General"}
 Cost price: ${existingData?.cost || "Unknown"}
 ${existingData ? `Current data: ${JSON.stringify(existingData)}` : ""}`;
     } else if (action === "generate_variants") {
       systemPrompt = `You are an e-commerce product specialist. Generate product variants based on the product type.
 
 IMPORTANT: Return ONLY valid JSON array of variant objects:
 [
   {"variation": "S", "chest_size": "38", "length_size": "26", "shoulder_size": "16"},
   {"variation": "M", "chest_size": "40", "length_size": "27", "shoulder_size": "17"}
 ]`;
 
       userPrompt = `Generate size variants for: "${productName}"
 Category: ${category || "Apparel"}
 Include appropriate measurements for each size.`;
     }
 
     // Call Lovable AI gateway
     const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
       },
       body: JSON.stringify({
         model: "google/gemini-2.5-flash",
         messages: [
           { role: "system", content: systemPrompt },
           { role: "user", content: userPrompt },
         ],
         temperature: 0.7,
         max_tokens: 2000,
       }),
     });
 
     if (!response.ok) {
       const error = await response.text();
       console.error("AI API error:", error);
       throw new Error("Failed to get AI response");
     }
 
     const data = await response.json();
     const aiResponse = data.choices[0]?.message?.content || "";
 
     // Try to parse JSON response if expected
     let parsedResponse = aiResponse;
     if (action !== "enhance_description") {
       try {
         // Clean up response - remove markdown code blocks if present
         let cleanedResponse = aiResponse.trim();
         if (cleanedResponse.startsWith("```json")) {
           cleanedResponse = cleanedResponse.slice(7);
         }
         if (cleanedResponse.startsWith("```")) {
           cleanedResponse = cleanedResponse.slice(3);
         }
         if (cleanedResponse.endsWith("```")) {
           cleanedResponse = cleanedResponse.slice(0, -3);
         }
         parsedResponse = JSON.parse(cleanedResponse.trim());
       } catch (e) {
         console.error("Failed to parse AI response as JSON:", e);
         // Return raw response if parsing fails
         parsedResponse = { raw: aiResponse, error: "Could not parse as JSON" };
       }
     }
 
     return new Response(
       JSON.stringify({ success: true, data: parsedResponse }),
       { headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   } catch (error) {
     const errorMessage = error instanceof Error ? error.message : "Unknown error";
     console.error("Error in AI product assistant:", errorMessage);
     return new Response(
       JSON.stringify({ success: false, error: errorMessage }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });