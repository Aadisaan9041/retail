import { X, ShoppingCart, Plus, Minus } from 'lucide-react';
import { useState } from 'react';
import { Product } from '@/types/retail';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ProductDetailModalProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
}

export function ProductDetailModal({
  product,
  open,
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);

  const isOutOfStock = product.quantity <= 0;
  const maxQuantity = product.quantity;

  const handleAddToCart = () => {
    onAddToCart(product, quantity);
    setQuantity(1);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="sr-only">{product.name}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Product Image */}
          <div className="aspect-square bg-secondary rounded-xl flex items-center justify-center overflow-hidden">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-8xl">📦</span>
            )}
          </div>

          {/* Product Details */}
          <div className="flex flex-col">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                {product.category || 'Uncategorized'}
              </p>
              <h2 className="text-2xl font-bold mb-2">{product.name}</h2>
              <p className="text-sm text-muted-foreground mb-4">SKU: {product.sku}</p>

              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl font-bold text-primary">
                  {formatCurrency(Number(product.price))}
                </span>
                {isOutOfStock ? (
                  <Badge variant="destructive">Out of Stock</Badge>
                ) : product.quantity <= product.low_stock_threshold ? (
                  <Badge className="bg-warning text-warning-foreground">
                    Only {product.quantity} left
                  </Badge>
                ) : (
                  <Badge className="bg-success/20 text-success">In Stock</Badge>
                )}
              </div>

              {/* Quantity Selector */}
              {!isOutOfStock && (
                <div className="mb-6">
                  <label className="text-sm font-medium mb-2 block">Quantity</label>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        disabled={quantity <= 1}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-12 text-center font-semibold text-lg">{quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                        disabled={quantity >= maxQuantity}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {product.quantity} available
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Add to Cart Button */}
            <Button
              size="lg"
              className="w-full"
              onClick={handleAddToCart}
              disabled={isOutOfStock}
            >
              <ShoppingCart className="w-5 h-5 mr-2" />
              {isOutOfStock ? 'Out of Stock' : `Add to Cart - ${formatCurrency(Number(product.price) * quantity)}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
