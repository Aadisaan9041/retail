import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Plus, Minus, Trash2, CreditCard, Banknote, X, User, Star, Barcode, Camera, Edit2, Check, UserPlus, Sparkles } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';
import { Product, CartItem, Customer, Transaction } from '@/types/retail';
import { ProductVariant } from '@/types/marketplace';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { CheckoutDialog } from './CheckoutDialog';
import { AIBarcodeScanner } from './AIBarcodeScanner';
import { UPIPaymentDialog } from './UPIPaymentDialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';

interface POSViewProps {
  products: Product[];
  cart: CartItem[];
  customers: Customer[];
  selectedCustomer: Customer | null;
  onAddToCart: (product: Product, variant?: ProductVariant) => void;
  onRemoveFromCart: (productId: string) => void;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onUpdateItemPrice: (productId: string, customPrice: number | undefined) => void;
  onClearCart: () => void;
  onProcessTransaction: (paymentMethod: 'cash' | 'card' | 'other', loyaltyPoints?: number) => Promise<any>;
  onSelectCustomer: (customer: Customer | null) => void;
  onAddCustomer: (customer: { name: string; email?: string | null; phone?: string | null }) => Promise<Customer | null>;
  onFindByBarcode: (barcode: string) => Product | undefined;
  cartTotal: { subtotal: number; tax: number; discount: number; total: number; pointsEarned: number };
}

export function POSView({
  products,
  cart,
  customers,
  selectedCustomer,
  onAddToCart,
  onRemoveFromCart,
  onUpdateQuantity,
  onUpdateItemPrice,
  onClearCart,
  onProcessTransaction,
  onSelectCustomer,
  onAddCustomer,
  onFindByBarcode,
  cartTotal,
}: POSViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [loyaltyPointsToRedeem, setLoyaltyPointsToRedeem] = useState(0);
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [pendingVariants, setPendingVariants] = useState<ProductVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>();
  const [pendingPrice, setPendingPrice] = useState('');
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);
  const [upiDialogOpen, setUpiDialogOpen] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPrice, setTempPrice] = useState<string>('');
  const [minimumBillGrossProfit, setMinimumBillGrossProfit] = useState(0);
  const priceInputRef = useRef<HTMLInputElement>(null);
  
  // Add customer dialog state
  const [addCustomerDialogOpen, setAddCustomerDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '' });
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  
  const barcodeRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))];

  const filteredProducts = products.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory && product.quantity > 0;
  });

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.email?.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone?.includes(customerSearch)
  );

  const { formatCurrency } = useCurrency();

  useEffect(() => {
    let active = true;
    supabase.from('app_settings').select('value').eq('key', 'minimum_bill_gross_profit').maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const value: any = data?.value;
        const amount = typeof value === 'object' && value !== null ? Number(value.amount) : Number(value);
        setMinimumBillGrossProfit(Number.isFinite(amount) ? Math.max(0, amount) : 0);
      });
    return () => { active = false; };
  }, []);

  const billGrossProfit = useMemo(() => {
    const revenue = cart.reduce((sum, item) => {
      const price = item.customPrice ?? Number(item.variant?.price ?? item.product.price);
      return sum + price * item.quantity;
    }, 0);
    const cost = cart.reduce((sum, item) => {
      const unitCost = Number(item.variant?.cost ?? item.product.cost);
      return sum + unitCost * item.quantity;
    }, 0);
    return revenue - cost - cartTotal.discount;
  }, [cart, cartTotal.discount]);

  const billProfitAllowed = billGrossProfit >= minimumBillGrossProfit;

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    handleBarcodeScan(barcodeInput.trim());
    setBarcodeInput('');
  };

  const handleBarcodeScan = async (barcode: string) => {
    const product = onFindByBarcode(barcode);
    if (product) {
      // Barcode/manual lookup follows the exact same confirmation flow as visual AI.
      await handleVisualProductFound(product);
    } else {
      toast({
        title: 'Product Not Found',
        description: `No product found with barcode/SKU: ${barcode}`,
        variant: 'destructive',
      });
    }
  };

  const handleVisualProductFound = async (product: Product) => {
    setPendingProduct(product);
    setSelectedVariant(undefined);
    setPendingPrice(String(Number(product.price)));
    setIsLoadingVariants(true);
    try {
      const { data } = await supabase.from('product_variants').select('*').eq('product_id', product.id).gt('quantity', 0).order('created_at');
      setPendingVariants((data || []) as ProductVariant[]);
    } catch (error) {
      console.error('Variant lookup failed', error);
      setPendingVariants([]);
    } finally {
      setIsLoadingVariants(false);
    }
  };

  const confirmScannedProduct = () => {
    if (!pendingProduct) return;
    if (isLoadingVariants) return;
    if (pendingVariants.length > 0 && !selectedVariant) {
      toast({ title: 'Select a variant', description: 'Choose the size/colour variant before adding the item to the bill.', variant: 'destructive' });
      return;
    }
    const price = Number(pendingPrice);
    if (!Number.isFinite(price) || price < 0) {
      toast({ title: 'Invalid price', description: 'Enter the actual negotiated customer price.', variant: 'destructive' });
      return;
    }
    onAddToCart(pendingProduct, selectedVariant);
    if (price !== Number(selectedVariant?.price ?? pendingProduct.price)) {
      const key = selectedVariant?.id ? `${pendingProduct.id}:${selectedVariant.id}` : pendingProduct.id;
      onUpdateItemPrice(key, price);
    }
    toast({ title: 'Item confirmed', description: `${pendingProduct.name}${selectedVariant ? ` / ${selectedVariant.variation}` : ''} added at ${formatCurrency(price)}.` });
    setPendingProduct(null);
    setPendingVariants([]);
    setSelectedVariant(undefined);
    setPendingPrice('');
    setBarcodeScannerOpen(false);
  };

  const handleCheckoutClick = (method: 'cash' | 'card') => {
    if (cart.length === 0) {
      toast({
        title: 'Cart is empty',
        description: 'Add items to cart before checkout.',
        variant: 'destructive',
      });
      return;
    }
    setPendingPaymentMethod(method);
    setCheckoutDialogOpen(true);
    setMobileCartOpen(false);
  };

  const handleConfirmCheckout = async (finalPrice: number, customerDetails?: { name: string; phone: string; email: string }) => {
    const result = await onProcessTransaction(pendingPaymentMethod, loyaltyPointsToRedeem);
    if (result) {
      setLoyaltyPointsToRedeem(0);
      return result;
    }
    toast({
      title: 'Transaction Failed',
      description: 'There was an error processing the transaction.',
      variant: 'destructive',
    });
    return null;
  };

  const handleStartEditPrice = (item: CartItem) => {
    const key = item.variant?.id ? `${item.product.id}:${item.variant.id}` : item.product.id;
    setEditingPriceId(key);
    setTempPrice(String(item.customPrice ?? Number(item.variant?.price ?? item.product.price)));
  };

  const handleSavePrice = (productId: string) => {
    const priceValue = parseFloat(tempPrice);
    if (isNaN(priceValue) || priceValue < 0) {
      toast({
        title: 'Invalid Price',
        description: 'Please enter a valid price.',
        variant: 'destructive',
      });
      return;
    }
    onUpdateItemPrice(productId, priceValue);
    setEditingPriceId(null);
    toast({
      title: 'Price Updated',
      description: 'Item price has been modified.',
    });
  };

  // Focus input when editing starts
  useEffect(() => {
    if (editingPriceId && priceInputRef.current) {
      priceInputRef.current.focus();
      priceInputRef.current.select();
    }
  }, [editingPriceId]);

  const handleResetPrice = (productId: string, originalPrice: number) => {
    onUpdateItemPrice(productId, undefined);
    setEditingPriceId(null);
    toast({
      title: 'Price Reset',
      description: 'Item price reset to original.',
    });
  };

  const handleAddCustomer = async () => {
    if (!newCustomer.name.trim()) {
      toast({
        title: 'Name Required',
        description: 'Please enter a customer name.',
        variant: 'destructive',
      });
      return;
    }

    setIsAddingCustomer(true);
    try {
      const customer = await onAddCustomer({
        name: newCustomer.name,
        email: newCustomer.email || null,
        phone: newCustomer.phone || null,
      });

      if (customer) {
        onSelectCustomer(customer);
        setAddCustomerDialogOpen(false);
        setCustomerDialogOpen(false);
        setNewCustomer({ name: '', email: '', phone: '' });
        toast({
          title: 'Customer Added',
          description: `${customer.name} has been added and selected.`,
        });
      }
    } catch (error) {
      console.error('Error adding customer:', error);
      toast({
        title: 'Error',
        description: 'Failed to add customer.',
        variant: 'destructive',
      });
    } finally {
      setIsAddingCustomer(false);
    }
  };

  const maxRedeemablePoints = selectedCustomer 
    ? Math.min(selectedCustomer.loyalty_points, Math.floor(cartTotal.subtotal * 100))
    : 0;

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Cart Content Component (reused for both mobile sheet and desktop sidebar)
  const CartContent = () => (
    <>
      <div className="p-4 sm:p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Current Order</h2>
          {cart.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearCart}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
        
        {/* Customer Selection */}
        <button
          onClick={() => setCustomerDialogOpen(true)}
          className="mt-4 w-full p-3 rounded-lg border border-dashed border-border hover:border-primary/50 transition-colors flex items-center gap-3"
        >
          <div className={cn(
            'p-2 rounded-lg',
            selectedCustomer ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
          )}>
            <User className="w-4 h-4" />
          </div>
          <div className="text-left flex-1">
            {selectedCustomer ? (
              <>
                <p className="text-sm font-medium">{selectedCustomer.name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Star className="w-3 h-3 text-warning" />
                  {selectedCustomer.loyalty_points} points
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Select or add customer</p>
            )}
          </div>
          {selectedCustomer && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSelectCustomer(null);
                setLoyaltyPointsToRedeem(0);
              }}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </button>
      </div>

      {/* Cart Items with Price Editing */}
      <div className="flex-1 overflow-y-auto p-4">
        {cart.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Cart is empty</p>
            <p className="text-sm mt-1">Click products to add</p>
          </div>
        ) : (
          <div className="space-y-3">
            {cart.map((item) => {
              const displayPrice = item.customPrice ?? Number(item.variant?.price ?? item.product.price);
              const hasCustomPrice = item.customPrice !== undefined;
              const cartKey = item.variant?.id ? `${item.product.id}:${item.variant.id}` : item.product.id;
              const isEditing = editingPriceId === cartKey;

              return (
                <div key={cartKey} className="p-3 rounded-lg bg-secondary/50 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.product.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">$</span>
                            <Input
                              ref={priceInputRef}
                              type="text"
                              inputMode="decimal"
                              value={tempPrice}
                              onChange={(e) => setTempPrice(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleSavePrice(cartKey);
                                } else if (e.key === 'Escape') {
                                  e.preventDefault();
                                  setEditingPriceId(null);
                                }
                              }}
                              className="h-6 w-20 text-xs"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => handleSavePrice(cartKey)}
                            >
                              <Check className="w-3 h-3 text-success" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => setEditingPriceId(null)}
                            >
                              <X className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'text-xs',
                              hasCustomPrice ? 'text-warning font-medium' : 'text-muted-foreground'
                            )}>
                              {formatCurrency(displayPrice)} each
                              {hasCustomPrice && ' (modified)'}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5"
                              onClick={() => handleStartEditPrice(item)}
                            >
                              <Edit2 className="w-3 h-3 text-muted-foreground" />
                            </Button>
                            {hasCustomPrice && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 px-2 text-xs"
                                onClick={() => handleResetPrice(cartKey, Number(item.variant?.price ?? item.product.price))}
                              >
                                Reset
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onRemoveFromCart(cartKey)}
                      className="p-1 text-destructive hover:bg-destructive/10 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onUpdateQuantity(cartKey, item.quantity - 1)}
                        className="p-1 rounded bg-secondary hover:bg-secondary/80"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => onUpdateQuantity(cartKey, item.quantity + 1)}
                        disabled={item.quantity >= (item.variant?.quantity ?? item.product.quantity)}
                        className="p-1 rounded bg-secondary hover:bg-secondary/80 disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="font-semibold text-sm">
                      {formatCurrency(displayPrice * item.quantity)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cart Total & Checkout */}
      <div className="p-4 sm:p-6 border-t border-border space-y-4">
        {/* Loyalty Points Redemption */}
        {selectedCustomer && selectedCustomer.loyalty_points > 0 && (
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-1">
                <Star className="w-4 h-4 text-warning" />
                Redeem Points
              </span>
              <span className="text-xs text-muted-foreground">
                Max: {maxRedeemablePoints}
              </span>
            </div>
            <Input
              type="number"
              min={0}
              max={maxRedeemablePoints}
              value={loyaltyPointsToRedeem}
              onChange={(e) => setLoyaltyPointsToRedeem(Math.min(Number(e.target.value), maxRedeemablePoints))}
              className="h-8 text-sm"
              placeholder="Points to redeem"
            />
            <p className="text-xs text-muted-foreground mt-1">
              = {formatCurrency(loyaltyPointsToRedeem * 0.01)} discount
            </p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(cartTotal.subtotal)}</span>
          </div>
          {cartTotal.discount > 0 && (
            <div className="flex justify-between text-sm text-success">
              <span>Loyalty Discount</span>
              <span>-{formatCurrency(cartTotal.discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax (8%)</span>
            <span>{formatCurrency(cartTotal.tax)}</span>
          </div>
          {cart.length > 0 && (
            <div className={cn('flex justify-between text-sm rounded-md px-2 py-1', billProfitAllowed ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}>
              <span>Bill gross profit</span>
              <span className="font-semibold">{formatCurrency(billGrossProfit)}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
            <span>Total</span>
            <span className="text-primary">{formatCurrency(cartTotal.total)}</span>
          </div>
          {cart.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Earns {cartTotal.pointsEarned} loyalty points
            </p>
          )}
          {cart.length > 0 && !billProfitAllowed && (
            <p className="text-xs font-medium text-destructive">
              Final billing is blocked. Minimum required bill profit is {formatCurrency(minimumBillGrossProfit)}.
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button
            onClick={() => handleCheckoutClick('cash')}
            disabled={cart.length === 0 || !billProfitAllowed}
            className="pos-button bg-success hover:bg-success/90"
            size="sm"
          >
            <Banknote className="w-4 h-4 mr-1" />
            Cash
          </Button>
          <Button
            onClick={() => handleCheckoutClick('card')}
            disabled={cart.length === 0 || !billProfitAllowed}
            className="pos-button bg-primary hover:bg-primary/90"
            size="sm"
          >
            <CreditCard className="w-4 h-4 mr-1" />
            Card
          </Button>
          <Button
            onClick={() => setUpiDialogOpen(true)}
            disabled={cart.length === 0 || !billProfitAllowed}
            className="pos-button bg-orange-500 hover:bg-orange-600"
            size="sm"
          >
            <span className="text-xs">UPI</span>
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-8rem)] lg:h-[calc(100vh-2rem)] gap-4 lg:gap-6 animate-slide-up">
      {/* Products Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="mb-4 lg:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Point of Sale</h1>
            <p className="text-muted-foreground text-sm mt-1">Select products to add to cart</p>
          </div>
          
          {/* Mobile Cart Button */}
          <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
            <SheetTrigger asChild>
              <Button className="lg:hidden relative" variant="outline">
                <Banknote className="w-4 h-4 mr-2" />
                Cart
                {cartItemCount > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs" variant="destructive">
                    {cartItemCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
              <SheetHeader className="p-4 border-b border-border">
                <SheetTitle>Shopping Cart</SheetTitle>
              </SheetHeader>
              <div className="flex-1 flex flex-col overflow-hidden">
                <CartContent />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Barcode Scanner Input */}
        <div className="flex gap-2 mb-4">
          <form onSubmit={handleBarcodeSubmit} className="flex-1">
            <div className="relative">
              <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                ref={barcodeRef}
                placeholder="Scan barcode or enter SKU..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="pl-10 input-retail"
              />
            </div>
          </form>
          <Button
            variant="outline"
            onClick={() => setBarcodeScannerOpen(true)}
            className="shrink-0"
          >
            <Camera className="w-5 h-5" />
            <span className="hidden sm:inline ml-2">Scan</span>
          </Button>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-2 sm:gap-4 mb-4 lg:mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 input-retail"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-4 lg:mb-6 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={cn(
                'px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all shrink-0',
                selectedCategory === category
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              )}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => onAddToCart(product)}
                className="product-card p-3 sm:p-4 text-left hover:border-primary/50"
              >
                <div className="aspect-square bg-secondary rounded-lg mb-2 sm:mb-3 flex items-center justify-center">
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <span className="text-3xl sm:text-4xl">📦</span>
                  )}
                </div>
                <h3 className="font-semibold text-xs sm:text-sm line-clamp-2">{product.name}</h3>
                <p className="text-xs text-muted-foreground mt-1 hidden sm:block">{product.sku}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="font-bold text-primary text-sm sm:text-base">{formatCurrency(Number(product.price))}</p>
                  <span className={cn(
                    'text-xs px-1.5 sm:px-2 py-0.5 rounded-full',
                    product.quantity <= product.low_stock_threshold
                      ? 'bg-warning/20 text-warning'
                      : 'bg-success/20 text-success'
                  )}>
                    {product.quantity}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop Cart Section */}
      <div className="hidden lg:flex w-96 glass-card rounded-xl flex-col">
        <CartContent />
      </div>

      {/* Customer Selection Dialog */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Select Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Add Customer Button */}
            <Button
              onClick={() => setAddCustomerDialogOpen(true)}
              variant="outline"
              className="w-full"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Add New Customer
            </Button>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="pl-10 input-retail"
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredCustomers.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No customers found</p>
              ) : (
                filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => {
                      onSelectCustomer(customer);
                      setCustomerDialogOpen(false);
                      setCustomerSearch('');
                    }}
                    className="w-full p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors flex items-center justify-between"
                  >
                    <div className="text-left">
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-xs text-muted-foreground">{customer.email || customer.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium flex items-center gap-1">
                        <Star className="w-3 h-3 text-warning" />
                        {customer.loyalty_points}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(Number(customer.total_spent))} spent
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Customer Dialog */}
      <Dialog open={addCustomerDialogOpen} onOpenChange={setAddCustomerDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                placeholder="Customer name"
                className="input-retail"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                placeholder="customer@email.com"
                className="input-retail"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                placeholder="+1 234 567 8900"
                className="input-retail"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCustomerDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCustomer} disabled={isAddingCustomer}>
              {isAddingCustomer ? 'Adding...' : 'Add Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <CheckoutDialog
        isOpen={checkoutDialogOpen}
        onClose={() => setCheckoutDialogOpen(false)}
        cart={cart}
        cartTotal={cartTotal}
        selectedCustomer={selectedCustomer}
        paymentMethod={pendingPaymentMethod}
        loyaltyPointsToRedeem={loyaltyPointsToRedeem}
        onConfirm={handleConfirmCheckout}
      />

      {/* Visual recognition confirmation: AI proposes; cashier confirms product/variant and negotiated price. */}
      <Dialog open={!!pendingProduct} onOpenChange={(open) => { if (!open) { setPendingProduct(null); setPendingVariants([]); setSelectedVariant(undefined); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Confirm Item & Customer Price</DialogTitle></DialogHeader>
          {pendingProduct && (
            <div className="space-y-4">
              <div className="flex gap-3 p-3 rounded-lg bg-secondary/50">
                {pendingProduct.image_url ? <img src={pendingProduct.image_url} alt={pendingProduct.name} className="w-20 h-20 object-cover rounded-lg" /> : null}
                <div className="min-w-0">
                  <p className="font-semibold">{pendingProduct.name}</p>
                  <p className="text-xs text-muted-foreground">{pendingProduct.category || 'Uncategorized'}</p>
                  <p className="text-xs mt-1">Colour: {pendingProduct.color || '—'} · Pattern: {pendingProduct.pattern || '—'}</p>
                </div>
              </div>
              {isLoadingVariants ? <p className="text-sm text-muted-foreground">Loading available variants…</p> : pendingVariants.length > 0 ? (
                <div className="space-y-2">
                  <Label>Variant / Size</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {pendingVariants.map(v => (
                      <Button key={v.id} type="button" variant={selectedVariant?.id === v.id ? 'default' : 'outline'} onClick={() => { setSelectedVariant(v); setPendingPrice(String(Number(v.price))); }}>
                        {v.variation}{v.color ? ` · ${v.color}` : ''} · {formatCurrency(Number(v.price))}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Normal price</Label>
                <p className="text-sm text-muted-foreground">{formatCurrency(Number(selectedVariant?.price ?? pendingProduct.price))}</p>
                <Label>Actual customer price</Label>
                <Input autoFocus type="number" min="0" step="1" inputMode="decimal" value={pendingPrice} onChange={e => setPendingPrice(e.target.value)} />
                <p className="text-xs text-muted-foreground">Enter the final negotiated price. This changes only this sale, not the catalogue price.</p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPendingProduct(null)}>Cancel</Button>
                <Button onClick={confirmScannedProduct}><Check className="w-4 h-4 mr-2" />Confirm & Add to Bill</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI-Enhanced Barcode Scanner Dialog */}
      <AIBarcodeScanner
        isOpen={barcodeScannerOpen}
        onClose={() => setBarcodeScannerOpen(false)}
        onScan={handleBarcodeScan}
        onProductFound={handleVisualProductFound}
        products={products}
      />

      {/* UPI Payment Dialog */}
      <UPIPaymentDialog
        isOpen={upiDialogOpen}
        onClose={() => setUpiDialogOpen(false)}
        amount={cartTotal.total}
        onPaymentConfirmed={async () => {
          const result = await onProcessTransaction('other', loyaltyPointsToRedeem);
          if (result?.blocked) {
            toast({ title: 'Bill cannot be finalized', description: result.reason, variant: 'destructive' });
            return;
          }
          setLoyaltyPointsToRedeem(0);
          setUpiDialogOpen(false);
        }}
      />
    </div>
  );
}
