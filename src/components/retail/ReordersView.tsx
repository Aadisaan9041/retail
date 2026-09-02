import { useState } from 'react';
import { Package, Check, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { ReorderRequest } from '@/types/retail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ReordersViewProps {
  reorderRequests: ReorderRequest[];
  onFulfillReorder: (id: string, quantityReceived: number) => Promise<boolean>;
}

export function ReordersView({ reorderRequests, onFulfillReorder }: ReordersViewProps) {
  const [fulfillDialogOpen, setFulfillDialogOpen] = useState(false);
  const [selectedReorder, setSelectedReorder] = useState<ReorderRequest | null>(null);
  const [quantityReceived, setQuantityReceived] = useState(0);
  const { toast } = useToast();

  const pendingReorders = reorderRequests.filter(r => r.status === 'pending');
  const fulfilledReorders = reorderRequests.filter(r => r.status === 'fulfilled');

  const handleFulfill = async () => {
    if (!selectedReorder || quantityReceived <= 0) return;

    const success = await onFulfillReorder(selectedReorder.id, quantityReceived);
    if (success) {
      toast({
        title: 'Reorder Fulfilled',
        description: `${quantityReceived} units received for ${selectedReorder.product?.name}.`,
      });
      setFulfillDialogOpen(false);
      setSelectedReorder(null);
      setQuantityReceived(0);
    }
  };

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));

  return (
    <div className="space-y-4 sm:space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Reorder Requests</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">Manage automatic restock requests</p>
      </div>

      {/* Pending Reorders */}
      <div>
        <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
          Pending ({pendingReorders.length})
        </h2>

        {pendingReorders.length === 0 ? (
          <div className="glass-card rounded-xl p-6 sm:p-8 text-center text-muted-foreground">
            <RefreshCw className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm sm:text-base">No pending reorder requests</p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {pendingReorders.map((reorder) => (
              <div key={reorder.id} className="glass-card rounded-xl p-3 sm:p-4">
                {/* Mobile Layout */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 rounded-lg bg-warning/20 text-warning flex-shrink-0">
                      <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm sm:text-base truncate">{reorder.product?.name || 'Unknown Product'}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        SKU: {reorder.product?.sku} • Requested: {reorder.quantity} units
                      </p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                        Created: {formatDate(reorder.created_at)}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedReorder(reorder);
                      setQuantityReceived(reorder.quantity);
                      setFulfillDialogOpen(true);
                    }}
                    className="bg-success hover:bg-success/90 w-full sm:w-auto"
                    size="sm"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Fulfill
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fulfilled Reorders */}
      {fulfilledReorders.length > 0 && (
        <div>
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
            <Check className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
            Fulfilled ({fulfilledReorders.length})
          </h2>
          <div className="space-y-2 sm:space-y-3">
            {fulfilledReorders.slice(0, 10).map((reorder) => (
              <div key={reorder.id} className="glass-card rounded-xl p-3 sm:p-4 opacity-75">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="p-2 sm:p-3 rounded-lg bg-success/20 text-success flex-shrink-0">
                      <Package className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm sm:text-base truncate">{reorder.product?.name || 'Unknown Product'}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {reorder.quantity} units received
                      </p>
                    </div>
                  </div>
                  <span className={cn('px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium badge-success flex-shrink-0')}>
                    Fulfilled
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fulfill Dialog */}
      <Dialog open={fulfillDialogOpen} onOpenChange={setFulfillDialogOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md bg-card border-border mx-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Fulfill Reorder</DialogTitle>
          </DialogHeader>
          {selectedReorder && (
            <div className="space-y-4">
              <div className="p-3 sm:p-4 rounded-lg bg-secondary/50">
                <p className="font-semibold text-sm sm:text-base">{selectedReorder.product?.name}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Requested: {selectedReorder.quantity} units
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qty" className="text-sm">Quantity Received</Label>
                <Input
                  id="qty"
                  type="number"
                  min={1}
                  value={quantityReceived}
                  onChange={(e) => setQuantityReceived(Number(e.target.value))}
                  className="input-retail text-sm sm:text-base"
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4">
                <Button variant="outline" onClick={() => setFulfillDialogOpen(false)} className="w-full sm:w-auto order-2 sm:order-1">
                  Cancel
                </Button>
                <Button onClick={handleFulfill} className="bg-success hover:bg-success/90 w-full sm:w-auto order-1 sm:order-2">
                  Confirm Receipt
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
