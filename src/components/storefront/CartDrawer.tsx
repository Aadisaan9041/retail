import { X, Plus, Minus, Trash2, ShoppingBag, Wallet, Star, ArrowLeft, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CartItem } from '@/types/retail';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import { PaymentDialog } from './PaymentDialog';
import { LoyaltyTierBadge } from './LoyaltyTierBadge';
import { DeliveryPartnerSelect } from './DeliveryPartnerSelect';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
  onCheckout: (paymentMethod: 'cash' | 'card' | 'other') => Promise<any>;
  cartTotal: {
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    pointsEarned: number;
  };
  merchantVPA?: string;
  merchantName?: string;
}

interface LoyaltyTier {
  id: string;
  name: string;
  min_points: number;
  discount_percentage: number;
  benefits: string[] | null;
  color: string | null;
}

interface DeliveryPartner {
  id: string;
  name: string;
  delivery_fee: number;
  estimated_delivery_time: string | null;
  service_areas: string[] | null;
}

// Calculate total weight from cart items using net_weight_grams
const calculateTotalWeight = (cart: CartItem[]): number => {
  return cart.reduce((total, item) => {
    const weight = item.product.net_weight_grams || 500; // default 500g if not set
    return total + weight * item.quantity;
  }, 0);
};

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
  pincode: string;
}

type CheckoutStep = 'cart' | 'delivery' | 'payment';

export function CartDrawer({
  open,
  onClose,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onCheckout,
  cartTotal,
  merchantVPA = 'merchant@upi',
  merchantName = 'My Store',
}: CartDrawerProps) {
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('cart');
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [loyaltyTiers, setLoyaltyTiers] = useState<LoyaltyTier[]>([]);
  const [selectedDeliveryPartner, setSelectedDeliveryPartner] = useState<DeliveryPartner | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: '',
    email: '',
    phone: '',
    address: '',
    pincode: '',
  });
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();

  // Fetch loyalty tiers
  useEffect(() => {
    const fetchTiers = async () => {
      const { data } = await supabase
        .from('loyalty_tiers')
        .select('*')
        .order('min_points');
      setLoyaltyTiers(data || []);
    };
    fetchTiers();
  }, []);

  // Reset step when drawer closes
  useEffect(() => {
    if (!open) {
      setCheckoutStep('cart');
    }
  }, [open]);

  // Calculate total including delivery
  const deliveryFee = selectedDeliveryPartner?.delivery_fee || 0;
  const finalTotal = cartTotal.total + deliveryFee;

  // Get current tier based on cart total
  const previewPoints = Math.floor(cartTotal.total);
  const currentTier = loyaltyTiers.length > 0 
    ? [...loyaltyTiers].reverse().find(t => previewPoints >= t.min_points) || loyaltyTiers[0]
    : null;

  const handleProceedToDelivery = () => {
    if (cart.length === 0) return;
    setCheckoutStep('delivery');
  };

  const handleProceedToPayment = () => {
    if (!customerInfo.name || !customerInfo.address || !customerInfo.pincode || customerInfo.pincode.length !== 6) {
      toast({
        title: 'Missing Information',
        description: 'Please enter your name, delivery address, and a valid 6-digit pincode.',
        variant: 'destructive',
      });
      return;
    }
    if (!selectedDeliveryPartner) {
      toast({
        title: 'Select Delivery Partner',
        description: 'Please choose a delivery partner for your order.',
        variant: 'destructive',
      });
      return;
    }
    setShowPaymentDialog(true);
  };

  const generateTrackingNumber = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'ORD-';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handlePaymentComplete = async (method: string) => {
    const paymentMethod = method === 'upi' ? 'other' : method === 'card' ? 'card' : 'other';
    const transaction = await onCheckout(paymentMethod as 'cash' | 'card' | 'other');
    
    if (transaction) {
      const trackingNumber = generateTrackingNumber();
      
      await supabase.from('orders').insert({
        transaction_id: transaction.id,
        customer_name: customerInfo.name,
        customer_email: customerInfo.email,
        customer_phone: customerInfo.phone,
        delivery_address: customerInfo.address,
        delivery_pincode: customerInfo.pincode,
        delivery_partner_id: selectedDeliveryPartner?.id?.startsWith('delhivery-') ? null : selectedDeliveryPartner?.id,
        delivery_fee: deliveryFee,
        tracking_number: trackingNumber,
        status: 'pending',
        estimated_delivery: selectedDeliveryPartner?.estimated_delivery_time,
        status_history: [{ status: 'pending', timestamp: new Date().toISOString(), message: 'Order placed successfully' }],
      });

      toast({
        title: 'Order Placed Successfully!',
        description: `Your tracking number is ${trackingNumber}. Track at /track-order`,
      });
    }
    
    setShowPaymentDialog(false);
    setCheckoutStep('cart');
    setSelectedDeliveryPartner(null);
    setCustomerInfo({ name: '', email: '', phone: '', address: '', pincode: '' });
    onClose();
  };

  const renderCartStep = () => (
    <>
      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-4 space-y-3 sm:space-y-4">
        {cart.map((item) => (
          <div
            key={item.product.id}
            className="flex gap-3 sm:gap-4 p-2.5 sm:p-3 rounded-lg bg-secondary/50"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
              {item.product.image_url ? (
                <img
                  src={item.product.image_url}
                  alt={item.product.name}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <span className="text-xl sm:text-2xl">📦</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-xs sm:text-sm line-clamp-2">{item.product.name}</h4>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                {formatCurrency(Number(item.product.price))} each
              </p>
              
              <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                <button
                  onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                  className="p-1 rounded bg-secondary hover:bg-secondary/80"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="w-6 sm:w-8 text-center text-xs sm:text-sm font-medium">{item.quantity}</span>
                <button
                  onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                  disabled={item.quantity >= item.product.quantity}
                  className="p-1 rounded bg-secondary hover:bg-secondary/80 disabled:opacity-50"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>

            <div className="flex flex-col items-end justify-between">
              <button
                onClick={() => onRemoveItem(item.product.id)}
                className="p-1 text-destructive hover:bg-destructive/10 rounded"
              >
                <X className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
              <p className="font-semibold text-xs sm:text-sm">
                {formatCurrency(Number(item.product.price) * item.quantity)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <Separator />

      <div className="p-4 sm:p-6 pt-4 space-y-3 sm:space-y-4">
        {currentTier && cart.length > 0 && (
          <div className="p-3 rounded-lg bg-secondary/30 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <Star className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium">Loyalty Rewards</span>
            </div>
            <LoyaltyTierBadge tier={currentTier} size="sm" />
            <p className="text-xs text-muted-foreground mt-2">
              Earn <span className="font-bold text-primary">{previewPoints}</span> points with this order!
            </p>
          </div>
        )}

        <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(cartTotal.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax (18% GST)</span>
            <span>{formatCurrency(cartTotal.tax)}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-base sm:text-lg font-bold">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(cartTotal.total)}</span>
          </div>
        </div>

        <Button
          className="w-full h-10 sm:h-12 text-sm sm:text-base"
          onClick={handleProceedToDelivery}
          disabled={cart.length === 0}
        >
          <Truck className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
          Proceed to Delivery
        </Button>

        <Button
          variant="outline"
          className="w-full text-xs sm:text-sm"
          size="sm"
          onClick={onClearCart}
        >
          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
          Clear Cart
        </Button>
      </div>
    </>
  );

  const renderDeliveryStep = () => (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setCheckoutStep('cart')}
        className="mb-2"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Cart
      </Button>

      <div className="space-y-4">
        <h3 className="font-semibold">Delivery Information</h3>
        
        <div className="space-y-3">
          <div>
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={customerInfo.name}
              onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
              placeholder="John Doe"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={customerInfo.email}
              onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
              placeholder="john@example.com"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={customerInfo.phone}
              onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
              placeholder="+91 98765 43210"
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="address">Delivery Address *</Label>
            <Input
              id="address"
              value={customerInfo.address}
              onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })}
              placeholder="123 Main Street, City, State"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="pincode">Delivery Pincode *</Label>
            <Input
              id="pincode"
              value={customerInfo.pincode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCustomerInfo({ ...customerInfo, pincode: val });
              }}
              placeholder="110001"
              maxLength={6}
              className="mt-1"
            />
          </div>
        </div>

        <Separator />

        <DeliveryPartnerSelect
          selectedPartnerId={selectedDeliveryPartner?.id || null}
          onSelect={setSelectedDeliveryPartner}
          totalWeightGrams={calculateTotalWeight(cart)}
          deliveryPincode={customerInfo.pincode}
        />

        <Separator />

        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cart Total</span>
            <span>{formatCurrency(cartTotal.total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery Fee</span>
            <span>{deliveryFee > 0 ? formatCurrency(deliveryFee) : 'FREE'}</span>
          </div>
          <Separator className="my-2" />
          <div className="flex justify-between text-lg font-bold">
            <span>Grand Total</span>
            <span className="text-primary">{formatCurrency(finalTotal)}</span>
          </div>
        </div>

        <Button
          className="w-full h-12"
          onClick={handleProceedToPayment}
        >
          <Wallet className="w-5 h-5 mr-2" />
          Proceed to Payment
        </Button>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg bg-card border-border flex flex-col p-0">
        <SheetHeader className="p-4 sm:p-6 pb-0">
          <SheetTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
            {checkoutStep === 'cart' 
              ? `Your Cart (${cart.length} item${cart.length !== 1 ? 's' : ''})` 
              : 'Delivery & Checkout'}
          </SheetTitle>
        </SheetHeader>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4">
            <ShoppingBag className="w-12 h-12 sm:w-16 sm:h-16 mb-4 opacity-50" />
            <p className="text-base sm:text-lg font-medium">Your cart is empty</p>
            <p className="text-xs sm:text-sm">Add some products to get started</p>
            <Button className="mt-4" size="sm" onClick={onClose}>
              Continue Shopping
            </Button>
          </div>
        ) : (
          <>
            {checkoutStep === 'cart' && renderCartStep()}
            {checkoutStep === 'delivery' && renderDeliveryStep()}
          </>
        )}

        <PaymentDialog
          isOpen={showPaymentDialog}
          onClose={() => setShowPaymentDialog(false)}
          amount={finalTotal}
          onPaymentComplete={handlePaymentComplete}
        />
      </SheetContent>
    </Sheet>
  );
}
