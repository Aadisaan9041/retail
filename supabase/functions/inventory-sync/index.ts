import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InventorySyncRequest {
  productId: string;
  quantitySold: number;
  dropshipProviderId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { productId, quantitySold, dropshipProviderId }: InventorySyncRequest = await req.json();

    console.log(`Processing inventory sync for product ${productId}, quantity sold: ${quantitySold}`);

    // Get current product info
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (productError) {
      console.error("Error fetching product:", productError);
      return new Response(
        JSON.stringify({ success: false, error: "Product not found" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const newQuantity = Math.max(0, product.quantity - quantitySold);
    
    // Update the product quantity
    const { error: updateError } = await supabase
      .from('products')
      .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
      .eq('id', productId);

    if (updateError) {
      console.error("Error updating product quantity:", updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to update inventory" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let autoReorderCreated = false;

    // Check if auto-reorder should be triggered
    if (product.auto_reorder && newQuantity <= product.low_stock_threshold) {
      // Check if there's already a pending reorder for this product
      const { data: existingReorder } = await supabase
        .from('reorder_requests')
        .select('id')
        .eq('product_id', productId)
        .eq('status', 'pending')
        .single();

      if (!existingReorder) {
        const { error: reorderError } = await supabase
          .from('reorder_requests')
          .insert({
            product_id: productId,
            quantity: product.reorder_quantity || 50,
            status: 'pending',
          });

        if (!reorderError) {
          autoReorderCreated = true;
          console.log(`Auto-reorder created for product ${product.name}`);
        }
      }
    }

    // If this is a dropship product, we could notify the supplier here
    // This would integrate with the dropship provider's API
    if (dropshipProviderId) {
      console.log(`Notifying dropship provider ${dropshipProviderId} about sale`);
      // In a real implementation, you would call the dropship provider's API here
      // to notify them of the sale and update their inventory
    }

    const response = {
      success: true,
      productId,
      previousQuantity: product.quantity,
      newQuantity,
      autoReorderCreated,
      lowStockWarning: newQuantity <= product.low_stock_threshold,
      outOfStock: newQuantity === 0,
    };

    console.log("Inventory sync completed:", response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in inventory-sync function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
