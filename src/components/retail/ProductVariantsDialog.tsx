import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Trash2, Copy, Loader2, Sparkles } from 'lucide-react';
import { Product } from '@/types/retail';
import { ProductVariant, MARKETPLACE_OPTIONS } from '@/types/marketplace';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProductVariantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

interface VariantFormData {
  id?: string;
  variation: string;
  color: string;
  sku: string;
  barcode: string;
  price: number;
  mrp: number;
  cost: number;
  quantity: number;
  meesho_price: number;
  wrong_defective_price: number;
  chest_size: string;
  length_size: string;
  shoulder_size: string;
  image_url: string;
}

const defaultVariant: VariantFormData = {
  variation: '',
  color: '',
  sku: '',
  barcode: '',
  price: 0,
  mrp: 0,
  cost: 0,
  quantity: 0,
  meesho_price: 0,
  wrong_defective_price: 0,
  chest_size: '',
  length_size: '',
  shoulder_size: '',
  image_url: '',
};

// Size measurement mappings for T-shirts
const SIZE_MEASUREMENTS: Record<string, { chest: string; length: string; shoulder: string }> = {
  'XS': { chest: '36', length: '25', shoulder: '15' },
  'S': { chest: '38', length: '26', shoulder: '16' },
  'M': { chest: '40', length: '27', shoulder: '17' },
  'L': { chest: '42', length: '28', shoulder: '18' },
  'XL': { chest: '44', length: '29', shoulder: '19' },
  'XXL': { chest: '46', length: '30', shoulder: '20' },
  'XXXL': { chest: '48', length: '31', shoulder: '21' },
  '4XL': { chest: '50', length: '32', shoulder: '22' },
  '5XL': { chest: '52', length: '33', shoulder: '23' },
};

export function ProductVariantsDialog({ open, onOpenChange, product }: ProductVariantsDialogProps) {
  const [variants, setVariants] = useState<VariantFormData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && product) {
      fetchVariants();
    }
  }, [open, product]);

  const fetchVariants = async () => {
    if (!product) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', product.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setVariants(data.map(v => ({
          id: v.id,
          variation: v.variation || '',
          color: v.color || '',
          sku: v.sku || '',
          barcode: v.barcode || '',
          price: Number(v.price) || 0,
          mrp: Number(v.mrp) || 0,
          cost: Number(v.cost) || 0,
          quantity: v.quantity || 0,
          meesho_price: Number(v.meesho_price) || 0,
          wrong_defective_price: Number(v.wrong_defective_price) || 0,
          chest_size: v.chest_size || '',
          length_size: v.length_size || '',
          shoulder_size: v.shoulder_size || '',
          image_url: v.image_url || '',
        })));
      } else {
        setVariants([]);
      }
    } catch (error) {
      console.error('Error fetching variants:', error);
      toast({
        title: 'Error',
        description: 'Failed to load variants',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addVariant = () => {
    const newVariant: VariantFormData = {
      ...defaultVariant,
      sku: `${product?.sku || 'SKU'}-${variants.length + 1}`,
      price: Number(product?.price) || 0,
      mrp: Number(product?.mrp) || 0,
      cost: Number(product?.cost) || 0,
      color: product?.color || '',
    };
    setVariants([...variants, newVariant]);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: keyof VariantFormData, value: string | number) => {
    const updated = [...variants];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-fill measurements when size is selected
    if (field === 'variation' && typeof value === 'string') {
      const measurements = SIZE_MEASUREMENTS[value];
      if (measurements) {
        updated[index].chest_size = measurements.chest;
        updated[index].length_size = measurements.length;
        updated[index].shoulder_size = measurements.shoulder;
      }
    }

    // Auto-calculate wrong/defective price
    if (field === 'price' || field === 'meesho_price') {
      const price = field === 'meesho_price' ? value : updated[index].meesho_price || updated[index].price;
      updated[index].wrong_defective_price = Math.max(0, Number(price) - 22);
    }

    setVariants(updated);
  };

  const duplicateVariant = (index: number) => {
    const source = variants[index];
    const newVariant: VariantFormData = {
      ...source,
      id: undefined, // Remove ID so it creates a new record
      sku: `${source.sku}-COPY`,
      variation: '',
    };
    setVariants([...variants, newVariant]);
  };

  const generateAllSizes = () => {
    const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
    const baseVariant = variants[0] || {
      ...defaultVariant,
      price: Number(product?.price) || 0,
      mrp: Number(product?.mrp) || 0,
      cost: Number(product?.cost) || 0,
      color: product?.color || '',
    };

    const newVariants = sizes.map((size, idx) => {
      const measurements = SIZE_MEASUREMENTS[size];
      return {
        ...baseVariant,
        id: undefined,
        variation: size,
        sku: `${product?.sku || 'SKU'}-${size}`,
        chest_size: measurements?.chest || '',
        length_size: measurements?.length || '',
        shoulder_size: measurements?.shoulder || '',
        quantity: 10, // Default quantity per size
      };
    });

    setVariants(newVariants);
    toast({
      title: 'Sizes Generated',
      description: `Created ${sizes.length} size variants with auto-filled measurements`,
    });
  };

  const saveVariants = async () => {
    if (!product) return;

    setIsSaving(true);
    try {
      // Validate variants
      for (const variant of variants) {
        if (!variant.variation) {
          throw new Error('All variants must have a size/variation');
        }
        if (!variant.sku) {
          throw new Error('All variants must have a SKU');
        }
      }

      // Get existing variant IDs
      const existingIds = variants.filter(v => v.id).map(v => v.id);
      
      // Delete removed variants
      if (existingIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('product_variants')
          .delete()
          .eq('product_id', product.id)
          .not('id', 'in', `(${existingIds.join(',')})`);

        if (deleteError) throw deleteError;
      } else {
        // Delete all if no existing IDs (all are new)
        const { error: deleteAllError } = await supabase
          .from('product_variants')
          .delete()
          .eq('product_id', product.id);

        if (deleteAllError) throw deleteAllError;
      }

      // Upsert variants
      for (const variant of variants) {
        const variantData = {
          product_id: product.id,
          variation: variant.variation,
          color: variant.color || null,
          sku: variant.sku,
          barcode: variant.barcode || null,
          price: variant.price,
          mrp: variant.mrp,
          cost: variant.cost,
          quantity: variant.quantity,
          meesho_price: variant.meesho_price || null,
          wrong_defective_price: variant.wrong_defective_price || null,
          chest_size: variant.chest_size || null,
          length_size: variant.length_size || null,
          shoulder_size: variant.shoulder_size || null,
          image_url: variant.image_url || null,
        };

        if (variant.id) {
          const { error } = await supabase
            .from('product_variants')
            .update(variantData)
            .eq('id', variant.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('product_variants')
            .insert(variantData);
          if (error) throw error;
        }
      }

      toast({
        title: 'Variants Saved',
        description: `Successfully saved ${variants.length} variants`,
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error saving variants:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save variants',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl bg-card border-border max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Manage Variants - {product.name}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={generateAllSizes}>
                <Sparkles className="w-4 h-4 mr-1" />
                Generate All Sizes
              </Button>
              <Button variant="outline" size="sm" onClick={addVariant}>
                <Plus className="w-4 h-4 mr-1" />
                Add Variant
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : variants.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No variants yet. Add size/color combinations for this product.</p>
            <Button variant="outline" className="mt-4" onClick={generateAllSizes}>
              <Sparkles className="w-4 h-4 mr-2" />
              Auto-Generate Sizes (S, M, L, XL, XXL)
            </Button>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              {variants.map((variant, index) => (
                <div key={index} className="p-4 border border-border rounded-lg space-y-4 bg-secondary/20">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      Variant {index + 1}: {variant.variation || 'Unnamed'}
                      {variant.color && ` - ${variant.color}`}
                    </span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => duplicateVariant(index)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => removeVariant(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Size/Variation *</Label>
                      <Select 
                        value={variant.variation} 
                        onValueChange={(v) => updateVariant(index, 'variation', v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select size" />
                        </SelectTrigger>
                        <SelectContent>
                          {MARKETPLACE_OPTIONS.variations.map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Color</Label>
                      <Select 
                        value={variant.color} 
                        onValueChange={(v) => updateVariant(index, 'color', v)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select color" />
                        </SelectTrigger>
                        <SelectContent>
                          {MARKETPLACE_OPTIONS.colors.map((opt) => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">SKU *</Label>
                      <Input
                        value={variant.sku}
                        onChange={(e) => updateVariant(index, 'sku', e.target.value.toUpperCase())}
                        className="h-9 font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Barcode</Label>
                      <Input
                        value={variant.barcode}
                        onChange={(e) => updateVariant(index, 'barcode', e.target.value)}
                        className="h-9 font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Image URL</Label>
                      <Input
                        value={variant.image_url}
                        onChange={(e) => updateVariant(index, 'image_url', e.target.value)}
                        className="h-9 text-xs"
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-6 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Cost (₹)</Label>
                      <Input
                        type="number"
                        value={variant.cost}
                        onChange={(e) => updateVariant(index, 'cost', parseFloat(e.target.value) || 0)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Price (₹)</Label>
                      <Input
                        type="number"
                        value={variant.price}
                        onChange={(e) => updateVariant(index, 'price', parseFloat(e.target.value) || 0)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">MRP (₹)</Label>
                      <Input
                        type="number"
                        value={variant.mrp}
                        onChange={(e) => updateVariant(index, 'mrp', parseFloat(e.target.value) || 0)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Meesho Price</Label>
                      <Input
                        type="number"
                        value={variant.meesho_price}
                        onChange={(e) => updateVariant(index, 'meesho_price', parseFloat(e.target.value) || 0)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">W/D Returns</Label>
                      <Input
                        type="number"
                        value={variant.wrong_defective_price}
                        onChange={(e) => updateVariant(index, 'wrong_defective_price', parseFloat(e.target.value) || 0)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        type="number"
                        value={variant.quantity}
                        onChange={(e) => updateVariant(index, 'quantity', parseInt(e.target.value) || 0)}
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Chest Size (in)</Label>
                      <Input
                        value={variant.chest_size}
                        onChange={(e) => updateVariant(index, 'chest_size', e.target.value)}
                        className="h-9"
                        placeholder="38"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Length Size (in)</Label>
                      <Input
                        value={variant.length_size}
                        onChange={(e) => updateVariant(index, 'length_size', e.target.value)}
                        className="h-9"
                        placeholder="27"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Shoulder Size (in)</Label>
                      <Input
                        value={variant.shoulder_size}
                        onChange={(e) => updateVariant(index, 'shoulder_size', e.target.value)}
                        className="h-9"
                        placeholder="17"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={saveVariants} disabled={isSaving || variants.length === 0}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              `Save ${variants.length} Variant${variants.length !== 1 ? 's' : ''}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
