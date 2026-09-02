import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Product, Category, Supplier } from '@/types/retail';
import { useImageUpload } from '@/hooks/useImageUpload';
import { Upload, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  categories: Category[];
  onSave: (product: any) => void;
}

const defaultProduct = {
  name: '',
  sku: '',
  barcode: '',
  price: 0,
  cost: 0,
  mrp: 0,
  quantity: 0,
  category_id: '',
  supplier_id: '',
  low_stock_threshold: 10,
  reorder_quantity: 50,
  auto_reorder: false,
  image_url: '',
  net_weight_grams: 0,
};

export function ProductDialog({ open, onOpenChange, product, categories, onSave }: ProductDialogProps) {
  const [formData, setFormData] = useState(defaultProduct);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadImage, isUploading, uploadProgress } = useImageUpload();

  useEffect(() => {
    const fetchSuppliers = async () => {
      const { data } = await supabase.from('suppliers').select('*').eq('is_active', true).order('name');
      setSuppliers((data as any[] || []) as Supplier[]);
    };
    if (open) fetchSuppliers();
  }, [open]);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode || '',
        price: Number(product.price),
        cost: Number(product.cost),
        mrp: Number(product.mrp || 0),
        quantity: product.quantity,
        category_id: product.category_id || '',
        supplier_id: product.supplier_id || '',
        low_stock_threshold: product.low_stock_threshold,
        reorder_quantity: product.reorder_quantity || 50,
        auto_reorder: product.auto_reorder || false,
        image_url: product.image_url || '',
        net_weight_grams: product.net_weight_grams || 0,
      });
    } else {
      setFormData(defaultProduct);
    }
    setErrors({});
  }, [product, open]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.sku.trim()) newErrors.sku = 'SKU is required';
    if (formData.price <= 0) newErrors.price = 'Price must be greater than 0';
    if (formData.cost < 0) newErrors.cost = 'Cost cannot be negative';
    if (formData.quantity < 0) newErrors.quantity = 'Quantity cannot be negative';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSave({
        ...formData,
        category_id: formData.category_id || null,
        supplier_id: (formData.supplier_id && formData.supplier_id !== 'none') ? formData.supplier_id : null,
        barcode: formData.barcode || null,
        image_url: formData.image_url || null,
        mrp: formData.mrp || null,
        net_weight_grams: formData.net_weight_grams || null,
      });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await uploadImage(file);
    if (result) {
      setFormData({ ...formData, image_url: result.url });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = () => {
    setFormData({ ...formData, image_url: '' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Image Upload Section */}
          <div className="space-y-2">
            <Label>Product Image</Label>
            <div className="flex gap-4 items-start">
              {/* Image Preview */}
              <div className="w-24 h-24 rounded-lg bg-secondary flex items-center justify-center overflow-hidden flex-shrink-0">
                {formData.image_url ? (
                  <img
                    src={formData.image_url}
                    alt="Product preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                )}
              </div>

              {/* Upload Controls */}
              <div className="flex-1 space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                
                {isUploading ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </div>
                    <Progress value={uploadProgress} className="h-2" />
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Image
                    </Button>
                    {formData.image_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={removeImage}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, WebP or GIF. Max 5MB.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Product Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-retail"
              placeholder="Enter product name"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                className="input-retail font-mono"
                placeholder="ABC-001"
              />
              {errors.sku && <p className="text-xs text-destructive">{errors.sku}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode (optional)</Label>
              <Input
                id="barcode"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                className="input-retail font-mono"
                placeholder="123456789"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category_id}
              onValueChange={(value) => setFormData({ ...formData, category_id: value })}
            >
              <SelectTrigger className="input-retail">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier</Label>
            <Select
              value={formData.supplier_id}
              onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}
            >
              <SelectTrigger className="input-retail">
                <SelectValue placeholder="Select supplier (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No supplier</SelectItem>
                {suppliers.map((sup) => (
                  <SelectItem key={sup.id} value={sup.id}>
                    {sup.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price (₹)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                className="input-retail"
              />
              {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="mrp">MRP (₹)</Label>
              <Input
                id="mrp"
                type="number"
                step="0.01"
                value={formData.mrp}
                onChange={(e) => setFormData({ ...formData, mrp: parseFloat(e.target.value) || 0 })}
                className="input-retail"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cost">Cost (₹)</Label>
              <Input
                id="cost"
                type="number"
                step="0.01"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: parseFloat(e.target.value) || 0 })}
                className="input-retail"
              />
              {errors.cost && <p className="text-xs text-destructive">{errors.cost}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                className="input-retail"
              />
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold">Low Stock Alert</Label>
              <Input
                id="threshold"
                type="number"
                value={formData.low_stock_threshold}
                onChange={(e) => setFormData({ ...formData, low_stock_threshold: parseInt(e.target.value) || 10 })}
                className="input-retail"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (grams)</Label>
              <Input
                id="weight"
                type="number"
                value={formData.net_weight_grams}
                onChange={(e) => setFormData({ ...formData, net_weight_grams: parseInt(e.target.value) || 0 })}
                className="input-retail"
                placeholder="e.g. 500"
              />
              <p className="text-[10px] text-muted-foreground">Used for shipping charges</p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-secondary/50 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto Reorder</Label>
                <p className="text-xs text-muted-foreground">Automatically create reorder when stock is low</p>
              </div>
              <Switch
                checked={formData.auto_reorder}
                onCheckedChange={(checked) => setFormData({ ...formData, auto_reorder: checked })}
              />
            </div>
            {formData.auto_reorder && (
              <div className="space-y-2">
                <Label htmlFor="reorderQty">Reorder Quantity</Label>
                <Input
                  id="reorderQty"
                  type="number"
                  value={formData.reorder_quantity}
                  onChange={(e) => setFormData({ ...formData, reorder_quantity: parseInt(e.target.value) || 50 })}
                  className="input-retail"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isUploading}>
              {product ? 'Update Product' : 'Add Product'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
