import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    
    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Fetch products from database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: products, error: dbError } = await supabase
      .from('products')
      .select(`
        id,
        name,
        sku,
        price,
        quantity,
        image_url,
        categories(name)
      `)
      .gt('quantity', 0)
      .limit(100);

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to fetch products');
    }

    const productList = products?.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: p.price,
      quantity: p.quantity,
      image_url: p.image_url,
      category: (p.categories as any)?.name || 'Uncategorized'
    })) || [];

    // Use AI to understand the query and find matching products
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a product search assistant for a retail store. Given a natural language query from a customer, analyze the available products and return the most relevant matches.

Available products:
${JSON.stringify(productList, null, 2)}

Respond with a JSON object containing:
- "matches": array of product IDs that match the query, ordered by relevance (max 10)
- "interpretation": a brief explanation of how you interpreted the query
- "suggestions": any helpful suggestions for the customer

Be helpful and understand intent. For example:
- "something for a headache" → pain relievers, aspirin
- "gifts under $50" → products under $50 that make good gifts
- "healthy snacks" → low-sugar, organic snacks
- "red dress for a party" → red dresses, formal wear`
          },
          {
            role: 'user',
            content: query
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'search_results',
              description: 'Return product search results',
              parameters: {
                type: 'object',
                properties: {
                  matches: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Array of matching product IDs'
                  },
                  interpretation: {
                    type: 'string',
                    description: 'How the query was interpreted'
                  },
                  suggestions: {
                    type: 'string',
                    description: 'Helpful suggestions for the customer'
                  }
                },
                required: ['matches', 'interpretation'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'search_results' } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      throw new Error('AI gateway error');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      // Fallback to basic text search
      const lowerQuery = query.toLowerCase();
      const basicMatches = productList.filter(p => 
        p.name.toLowerCase().includes(lowerQuery) ||
        p.category.toLowerCase().includes(lowerQuery)
      );
      
      return new Response(JSON.stringify({
        products: basicMatches.slice(0, 10),
        interpretation: `Showing results for "${query}"`,
        suggestions: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const searchResults = JSON.parse(toolCall.function.arguments);
    const matchedProducts = searchResults.matches
      .map((id: string) => productList.find(p => p.id === id))
      .filter(Boolean);

    return new Response(JSON.stringify({
      products: matchedProducts,
      interpretation: searchResults.interpretation,
      suggestions: searchResults.suggestions || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('AI product search error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
