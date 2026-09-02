import { AlertTriangle, Package } from 'lucide-react';
import { Product } from '@/types/retail';
import { cn } from '@/lib/utils';

interface LowStockAlertProps {
  products: Product[];
}

export function LowStockAlert({ products }: LowStockAlertProps) {
  const getStockStatus = (quantity: number, threshold: number) => {
    if (quantity === 0) return { label: 'Out of Stock', class: 'badge-danger' };
    if (quantity <= threshold / 2) return { label: 'Critical', class: 'badge-danger' };
    return { label: 'Low Stock', class: 'badge-warning' };
  };

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Stock Alerts</h2>
        <AlertTriangle className="w-5 h-5 text-warning" />
      </div>

      {products.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>All products are well stocked</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => {
            const status = getStockStatus(product.quantity, product.low_stock_threshold);
            return (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 table-row-hover"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-warning/20 text-warning">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{product.name}</p>
                    <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn(
                    'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border',
                    status.class
                  )}>
                    {status.label}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">{product.quantity} left</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
