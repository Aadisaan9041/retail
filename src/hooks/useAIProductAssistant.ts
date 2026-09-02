 import { useState } from 'react';
 import { supabase } from '@/integrations/supabase/client';
 import { useToast } from '@/hooks/use-toast';
 
 interface AIProductDetails {
   name?: string;
   description?: string;
   brand?: string;
   generic_name?: string;
   color?: string;
   fabric?: string;
   pattern?: string;
   fit_shape?: string;
   occasion?: string;
   sleeve_length?: string;
   neck_type?: string;
   hemline?: string;
   length_type?: string;
   print_pattern_type?: string;
   sleeve_styling?: string;
   net_weight_grams?: number;
   suggested_mrp?: number;
   suggested_price?: number;
   suggested_variants?: string[];
   keywords?: string[];
   marketplace_tips?: {
     meesho?: string;
     amazon?: string;
     flipkart?: string;
   };
 }
 
 interface AIResponse {
   success: boolean;
   data: AIProductDetails | string | { raw: string; error: string };
   error?: string;
 }
 
 export function useAIProductAssistant() {
   const [isLoading, setIsLoading] = useState(false);
   const { toast } = useToast();
 
   const generateProductDetails = async (
     productName: string,
     category?: string,
     existingData?: Record<string, unknown>
   ): Promise<AIProductDetails | null> => {
     setIsLoading(true);
     try {
       const { data, error } = await supabase.functions.invoke('ai-product-assistant', {
         body: {
           action: 'generate_details',
           productName,
           category,
           existingData,
         },
       });
 
       if (error) throw error;
 
       const response = data as AIResponse;
       if (!response.success) {
         throw new Error(response.error || 'Failed to generate details');
       }
 
       toast({
         title: 'AI Generated Details',
         description: 'Product details have been generated successfully!',
       });
 
       return response.data as AIProductDetails;
     } catch (error) {
       const message = error instanceof Error ? error.message : 'Failed to generate details';
       toast({
         title: 'AI Error',
         description: message,
         variant: 'destructive',
       });
       return null;
     } finally {
       setIsLoading(false);
     }
   };
 
   const enhanceDescription = async (
     productName: string,
     currentDescription: string
   ): Promise<string | null> => {
     setIsLoading(true);
     try {
       const { data, error } = await supabase.functions.invoke('ai-product-assistant', {
         body: {
           action: 'enhance_description',
           productName,
           existingData: { description: currentDescription },
         },
       });
 
       if (error) throw error;
 
       const response = data as AIResponse;
       if (!response.success) {
         throw new Error(response.error || 'Failed to enhance description');
       }
 
       toast({
         title: 'Description Enhanced',
         description: 'Your product description has been improved!',
       });
 
       return response.data as string;
     } catch (error) {
       const message = error instanceof Error ? error.message : 'Failed to enhance description';
       toast({
         title: 'AI Error',
         description: message,
         variant: 'destructive',
       });
       return null;
     } finally {
       setIsLoading(false);
     }
   };
 
   const suggestPricing = async (
     productName: string,
     category?: string,
     costPrice?: number
   ): Promise<{ mrp: number; selling_price: number; meesho_price: number; wrong_defective_price: number; reasoning: string } | null> => {
     setIsLoading(true);
     try {
       const { data, error } = await supabase.functions.invoke('ai-product-assistant', {
         body: {
           action: 'suggest_pricing',
           productName,
           category,
           existingData: { cost: costPrice },
         },
       });
 
       if (error) throw error;
 
       const response = data as AIResponse;
       if (!response.success) {
         throw new Error(response.error || 'Failed to suggest pricing');
       }
 
       return response.data as { mrp: number; selling_price: number; meesho_price: number; wrong_defective_price: number; reasoning: string };
     } catch (error) {
       const message = error instanceof Error ? error.message : 'Failed to suggest pricing';
       toast({
         title: 'AI Error',
         description: message,
         variant: 'destructive',
       });
       return null;
     } finally {
       setIsLoading(false);
     }
   };
 
   const generateVariants = async (
     productName: string,
     category?: string
   ): Promise<Array<{ variation: string; chest_size?: string; length_size?: string; shoulder_size?: string }> | null> => {
     setIsLoading(true);
     try {
       const { data, error } = await supabase.functions.invoke('ai-product-assistant', {
         body: {
           action: 'generate_variants',
           productName,
           category,
         },
       });
 
       if (error) throw error;
 
       const response = data as AIResponse;
       if (!response.success) {
         throw new Error(response.error || 'Failed to generate variants');
       }
 
       return response.data as Array<{ variation: string; chest_size?: string; length_size?: string; shoulder_size?: string }>;
     } catch (error) {
       const message = error instanceof Error ? error.message : 'Failed to generate variants';
       toast({
         title: 'AI Error',
         description: message,
         variant: 'destructive',
       });
       return null;
     } finally {
       setIsLoading(false);
     }
   };
 
   return {
     isLoading,
     generateProductDetails,
     enhanceDescription,
     suggestPricing,
     generateVariants,
   };
 }