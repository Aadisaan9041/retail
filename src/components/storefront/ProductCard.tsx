import { ShoppingCart, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Product } from '@/types/retail';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/useCurrency';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  onViewDetails: (product: Product) => void;
}

export function ProductCard({ product, onAddToCart, onViewDetails }: ProductCardProps) {
  const { formatCurrency } = useCurrency();
  const isOutOfStock = product.quantity <= 0;
  const isLowStock = product.quantity > 0 && product.quantity <= product.low_stock_threshold;

  return (
    <div className="group glass-card rounded-xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_40px_hsl(var(--glow-primary))]">
      {/* Product Image */}
      <div 
        className="relative aspect-square bg-secondary cursor-pointer overflow-hidden"
        onClick={() => onViewDetails(product)}
      >
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl sm:text-6xl">📦</span>
          </div>
        )}
        
        {/* Stock Badge */}
        {isOutOfStock && (
          <Badge className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-destructive text-destructive-foreground text-[10px] sm:text-xs px-1.5 sm:px-2">
            Out of Stock
          </Badge>
        )}
        {isLowStock && !isOutOfStock && (
          <Badge className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-warning text-warning-foreground text-[10px] sm:text-xs px-1.5 sm:px-2">
            Only {product.quantity} left
          </Badge>
        )}

        {/* Quick View Overlay - Desktop only */}
        <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex items-center justify-center">
          <Button variant="secondary" size="sm" onClick={() => onViewDetails(product)}>
            <Eye className="w-4 h-4 mr-2" />
            Quick View
          </Button>
        </div>
      </div>

      {/* Product Info */}
      <div className="p-3 sm:p-4">
        <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider mb-0.5 sm:mb-1 truncate">
          {product.category || 'Uncategorized'}
        </p>
        <h3 
          className="font-semibold text-foreground text-sm sm:text-base line-clamp-2 cursor-pointer hover:text-primary transition-colors min-h-[2.5rem] sm:min-h-[3rem]"
          onClick={() => onViewDetails(product)}
        >
          {product.name}
        </h3>
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">SKU: {product.sku}</p>
        
        <div className="flex items-center justify-between mt-2 sm:mt-4 gap-2">
          <p className="text-base sm:text-xl font-bold text-primary truncate">
            {formatCurrency(Number(product.price))}
          </p>
          <Button
            size="sm"
            onClick={() => onAddToCart(product)}
            disabled={isOutOfStock}
            className={cn(
              'transition-all flex-shrink-0 h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm',
              isOutOfStock && 'opacity-50 cursor-not-allowed'
            )}
          >
            <ShoppingCart className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
            <span className="hidden xs:inline">Add</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
