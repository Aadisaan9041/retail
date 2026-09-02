import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Product } from '@/types/retail';

interface BarcodeLookupResult {
  success: boolean;
  found: boolean;
  source?: 'local' | 'marketplace';
  product?: Product;
  marketplaceData?: {
    source: string;
    name?: string;
    brand?: string;
    description?: string;
    category?: string;
    mrp?: number;
    imageUrl?: string;
    attributes?: Record<string, string>;
  };
  aiSuggestions?: {
    suggestions: string;
    barcodeAnalysis: {
      length: number;
      type: string;
      prefix: string;
    };
  };
  similarProducts?: Partial<Product>[];
  message?: string;
}

interface MarketplaceSyncResult {
  success: boolean;
  summary?: {
    total: number;
    successful: number;
    failed: number;
  };
  results?: Array<{
    marketplace: string;
    productId?: string;
    productName?: string;
    success: boolean;
    message?: string;
    error?: string;
  }>;
  error?: string;
}

export function useMarketplaceIntegration() {
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const lookupBarcode = useCallback(async (
    barcode: string,
    options?: {
      includeMarketplaceData?: boolean;
      searchSimilar?: boolean;
    }
  ): Promise<BarcodeLookupResult | null> => {
    if (!barcode.trim()) {
      toast({
        title: 'Invalid Barcode',
        description: 'Please provide a valid barcode',
        variant: 'destructive',
      });
      return null;
    }

    setIsLookingUp(true);
    try {
      const { data, error } = await supabase.functions.invoke('barcode-product-lookup', {
        body: {
          barcode: barcode.trim(),
          includeMarketplaceData: options?.includeMarketplaceData ?? true,
          searchSimilar: options?.searchSimilar ?? true,
        },
      });

      if (error) throw error;

      return data as BarcodeLookupResult;
    } catch (error) {
      console.error('Barcode lookup error:', error);
      toast({
        title: 'Lookup Failed',
        description: 'Failed to lookup barcode. Please try again.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLookingUp(false);
    }
  }, [toast]);

  const syncInventory = useCallback(async (
    marketplace: 'meesho' | 'amazon' | 'flipkart' | 'all',
    action: 'sync_stock' | 'update_price' | 'get_status',
    productId?: string,
    data?: { quantity?: number; price?: number }
  ): Promise<MarketplaceSyncResult | null> => {
    setIsSyncing(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('marketplace-inventory-sync', {
        body: {
          marketplace,
          action,
          productId,
          data,
        },
      });

      if (error) throw error;

      const syncResult = result as MarketplaceSyncResult;

      if (syncResult.success) {
        toast({
          title: 'Sync Completed',
          description: `Successfully synced ${syncResult.summary?.successful || 0} items to ${marketplace === 'all' ? 'all marketplaces' : marketplace}`,
        });
      } else {
        toast({
          title: 'Sync Partially Failed',
          description: `${syncResult.summary?.failed || 0} items failed to sync`,
          variant: 'destructive',
        });
      }

      return syncResult;
    } catch (error) {
      console.error('Inventory sync error:', error);
      toast({
        title: 'Sync Failed',
        description: 'Failed to sync inventory with marketplace',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsSyncing(false);
    }
  }, [toast]);

  const syncAllStock = useCallback(async () => {
    return syncInventory('all', 'sync_stock');
  }, [syncInventory]);

  const syncProductStock = useCallback(async (productId: string, quantity?: number) => {
    return syncInventory('all', 'sync_stock', productId, { quantity });
  }, [syncInventory]);

  const updateMarketplacePrice = useCallback(async (
    productId: string,
    price: number,
    marketplace: 'meesho' | 'amazon' | 'flipkart' | 'all' = 'all'
  ) => {
    return syncInventory(marketplace, 'update_price', productId, { price });
  }, [syncInventory]);

  return {
    lookupBarcode,
    syncInventory,
    syncAllStock,
    syncProductStock,
    updateMarketplacePrice,
    isLookingUp,
    isSyncing,
  };
}
