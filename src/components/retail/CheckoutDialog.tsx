import { useState, useEffect } from 'react';
import { Printer, Mail, MessageSquare, Send, CreditCard, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CartItem, Customer, Transaction } from '@/types/retail';
import { cn } from '@/lib/utils';
import { useRazorpay } from '@/hooks/useRazorpay';
import { useToast } from '@/hooks/use-toast';
import { escapeHtml, sanitizeCurrency, truncateText } from '@/lib/sanitize';
import { useCurrency } from '@/hooks/useCurrency';

interface CheckoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  cartTotal: { subtotal: number; tax: number; discount: number; total: number; pointsEarned: number };
  selectedCustomer: Customer | null;
  paymentMethod: 'cash' | 'card';
  loyaltyPointsToRedeem: number;
  onConfirm: (finalPrice: number, customerDetails?: { name: string; phone: string; email: string }) => Promise<Transaction | { blocked: true; reason: string } | null>;
}

type PrinterType = 'thermal-58mm' | 'thermal-80mm' | 'a4' | 'a5';

const printerLayouts: Record<PrinterType, { name: string; width: string }> = {
  'thermal-58mm': { name: '58mm Thermal', width: '58mm' },
  'thermal-80mm': { name: '80mm Thermal', width: '80mm' },
  'a4': { name: 'A4 Paper', width: '210mm' },
  'a5': { name: 'A5 Paper', width: '148mm' },
};

export function CheckoutDialog({
  isOpen,
  onClose,
  cart,
  cartTotal,
  selectedCustomer,
  paymentMethod,
  loyaltyPointsToRedeem,
  onConfirm,
}: CheckoutDialogProps) {
  const { toast } = useToast();
  const { initiatePayment } = useRazorpay();
  const [step, setStep] = useState<'review' | 'success'>('review');
  const [finalPrice, setFinalPrice] = useState(cartTotal.total);

  useEffect(() => { if (isOpen) setFinalPrice(cartTotal.total); }, [isOpen, cartTotal.total]);
  const [includeCustomerDetails, setIncludeCustomerDetails] = useState(false);
  const [customerName, setCustomerName] = useState(selectedCustomer?.name || '');
  const [customerPhone, setCustomerPhone] = useState(selectedCustomer?.phone || '');
  const [customerEmail, setCustomerEmail] = useState(selectedCustomer?.email || '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPrintOptions, setShowPrintOptions] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterType>('thermal-80mm');
  const [sendNotifications, setSendNotifications] = useState(false);
  const [isSendingNotification, setIsSendingNotification] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [isProcessingRazorpay, setIsProcessingRazorpay] = useState(false);

  const { formatCurrency } = useCurrency();

  const handleConfirmCheckout = async () => {
    setIsProcessing(true);
    const customerDetails = includeCustomerDetails ? {
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
    } : undefined;

    const result = await onConfirm(finalPrice, customerDetails);
    setIsProcessing(false);
    
    if (result && 'blocked' in result) {
      toast({ title: 'Bill cannot be finalized', description: result.reason, variant: 'destructive' });
      return;
    }
    if (result) {
      setTransaction(result);
      setStep('success');
    }
  };

  const handleRazorpayPayment = async () => {
    setIsProcessingRazorpay(true);
    
    try {
      const customerDetails = includeCustomerDetails ? {
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
      } : undefined;

      initiatePayment(
        {
          amount: finalPrice,
          customerName: customerDetails?.name || 'POS Customer',
          customerEmail: customerDetails?.email || '',
          customerPhone: customerDetails?.phone || '',
          description: `POS Transaction - ${cart.length} items`,
        },
        async (response) => {
          console.log('Razorpay payment success:', response.razorpay_payment_id);
          
          // Complete the transaction
          const result = await onConfirm(finalPrice, customerDetails);
          
          if (result && 'blocked' in result) {
            toast({ title: 'Bill cannot be finalized', description: result.reason, variant: 'destructive' });
            setIsProcessingRazorpay(false);
            return;
          }
          if (result) {
            setTransaction(result);
            setStep('success');
            toast({
              title: 'Payment Successful',
              description: `Card payment of ${formatCurrency(finalPrice)} processed via Razorpay`,
            });
          }
          setIsProcessingRazorpay(false);
        },
        (error) => {
          console.error('Razorpay payment failed:', error);
          toast({
            title: 'Payment Failed',
            description: error?.message || 'Card payment could not be processed',
            variant: 'destructive',
          });
          setIsProcessingRazorpay(false);
        }
      );
    } catch (error) {
      console.error('Error initiating Razorpay payment:', error);
      toast({
        title: 'Payment Error',
        description: 'Failed to initiate card payment',
        variant: 'destructive',
      });
      setIsProcessingRazorpay(false);
    }
  };


  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const layout = printerLayouts[selectedPrinter];
    const isThermal = selectedPrinter.includes('thermal');
    const fontSize = isThermal ? '10px' : '12px';
    const padding = isThermal ? '5mm' : '15mm';

    // Sanitize all user-controlled data to prevent XSS
    const safeCustomerName = escapeHtml(truncateText(customerName, 100));
    const safeCustomerPhone = escapeHtml(truncateText(customerPhone, 20));
    const safeCustomerEmail = escapeHtml(truncateText(customerEmail, 255));
    const safeReceiptId = transaction ? escapeHtml(transaction.id.slice(0, 8).toUpperCase()) : '';
    const safePaymentMethod = escapeHtml(paymentMethod.toUpperCase());

    // Sanitize cart items - use custom price if set
    const safeCartItems = cart.map(item => {
      const price = item.customPrice ?? Number(item.variant?.price ?? item.product.price);
      return {
        name: escapeHtml(truncateText(item.product.name, 50)),
        quantity: Math.floor(Math.max(0, Math.min(item.quantity, 9999))),
        price: sanitizeCurrency(price * item.quantity),
      };
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt</title>
        <style>
          @page { 
            size: ${escapeHtml(layout.width)} auto; 
            margin: 0;
          }
          body { 
            font-family: 'Courier New', monospace;
            font-size: ${escapeHtml(fontSize)};
            padding: ${escapeHtml(padding)};
            max-width: ${escapeHtml(layout.width)};
            margin: 0 auto;
          }
          .header { text-align: center; margin-bottom: 10px; }
          .header h1 { font-size: ${isThermal ? '14px' : '18px'}; margin: 0; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .item { display: flex; justify-content: space-between; margin: 4px 0; }
          .total { font-weight: bold; font-size: ${isThermal ? '12px' : '14px'}; }
          .footer { text-align: center; margin-top: 15px; font-size: ${isThermal ? '8px' : '10px'}; }
          .customer-info { margin: 10px 0; padding: 8px; background: #f5f5f5; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>RETAIL PRO</h1>
          <p>${escapeHtml(new Date().toLocaleString())}</p>
          ${safeReceiptId ? `<p>Receipt #${safeReceiptId}</p>` : ''}
        </div>
        
        ${includeCustomerDetails && safeCustomerName ? `
          <div class="customer-info">
            <strong>Customer:</strong> ${safeCustomerName}<br/>
            ${safeCustomerPhone ? `Phone: ${safeCustomerPhone}<br/>` : ''}
            ${safeCustomerEmail ? `Email: ${safeCustomerEmail}` : ''}
          </div>
        ` : ''}
        
        <div class="divider"></div>
        
        ${safeCartItems.map(item => `
          <div class="item">
            <span>${item.name} x${item.quantity}</span>
            <span>${formatCurrency(item.price)}</span>
          </div>
        `).join('')}
        
        <div class="divider"></div>
        
        <div class="item">
          <span>Subtotal</span>
          <span>${formatCurrency(sanitizeCurrency(cartTotal.subtotal))}</span>
        </div>
        ${cartTotal.discount > 0 ? `
          <div class="item">
            <span>Discount</span>
            <span>-${formatCurrency(sanitizeCurrency(cartTotal.discount))}</span>
          </div>
        ` : ''}
        <div class="item">
          <span>Tax (8%)</span>
          <span>${formatCurrency(sanitizeCurrency(cartTotal.tax))}</span>
        </div>
        <div class="divider"></div>
        <div class="item total">
          <span>TOTAL</span>
          <span>${formatCurrency(sanitizeCurrency(finalPrice))}</span>
        </div>
        <div class="item">
          <span>Payment Method</span>
          <span>${safePaymentMethod}</span>
        </div>
        
        ${cartTotal.pointsEarned > 0 ? `
          <div class="divider"></div>
          <p style="text-align: center;">You earned ${Math.floor(Math.max(0, cartTotal.pointsEarned))} loyalty points!</p>
        ` : ''}
        
        <div class="footer">
          <p>Thank you for shopping with us!</p>
          <p>Visit again soon</p>
        </div>
        
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleSendNotifications = async () => {
    if (!customerPhone && !customerEmail) return;
    
    setIsSendingNotification(true);
    
    try {
      // Send WhatsApp message via deep link
      if (customerPhone) {
        const message = encodeURIComponent(
          `Thank you for shopping at Retail Pro!\n\n` +
          `Receipt #${transaction?.id.slice(0, 8).toUpperCase() || 'N/A'}\n` +
          `Total: ${formatCurrency(finalPrice)}\n` +
          `Payment: ${paymentMethod.toUpperCase()}\n\n` +
          `Points earned: ${cartTotal.pointsEarned}\n\n` +
          `Visit again soon!`
        );
        const phoneNumber = customerPhone.replace(/\D/g, '');
        window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
      }
      
      // Send email via edge function
      if (customerEmail) {
        const { supabase } = await import('@/integrations/supabase/client');
        await supabase.functions.invoke('send-bill-notification', {
          body: {
            email: customerEmail,
            customerName: customerName,
            receiptId: transaction?.id.slice(0, 8).toUpperCase() || 'N/A',
            total: formatCurrency(finalPrice),
            paymentMethod: paymentMethod.toUpperCase(),
            pointsEarned: cartTotal.pointsEarned,
            items: cart.map(item => {
              const price = item.customPrice ?? Number(item.variant?.price ?? item.product.price);
              return {
                name: item.product.name,
                quantity: item.quantity,
                price: formatCurrency(price * item.quantity),
              };
            }),
            subtotal: formatCurrency(cartTotal.subtotal),
            tax: formatCurrency(cartTotal.tax),
            discount: cartTotal.discount > 0 ? formatCurrency(cartTotal.discount) : null,
          },
        });
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
    } finally {
      setIsSendingNotification(false);
    }
  };

  const handleClose = () => {
    setStep('review');
    setFinalPrice(cartTotal.total);
    setShowPrintOptions(false);
    setTransaction(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>
            {step === 'review' ? 'Review Order' : 'Transaction Complete!'}
          </DialogTitle>
        </DialogHeader>

        {step === 'review' && (
          <div className="space-y-4">
            {/* Order Summary */}
            <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-sm">Order Summary</h4>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {cart.map(item => {
                  const price = item.customPrice ?? Number(item.variant?.price ?? item.product.price);
                  const hasCustomPrice = item.customPrice !== undefined;
                  return (
                    <div key={item.product.id} className="flex justify-between text-sm">
                      <span className={hasCustomPrice ? 'text-warning' : ''}>
                        {item.product.name} × {item.quantity}
                        {hasCustomPrice && ' (modified)'}
                      </span>
                      <span>{formatCurrency(price * item.quantity)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border pt-2 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(cartTotal.subtotal)}</span>
                </div>
                {cartTotal.discount > 0 && (
                  <div className="flex justify-between text-sm text-success">
                    <span>Loyalty Discount</span>
                    <span>-{formatCurrency(cartTotal.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>Tax (8%)</span>
                  <span>{formatCurrency(cartTotal.tax)}</span>
                </div>
              </div>
            </div>

            {/* Final price is the sum of the already-confirmed negotiated item prices. */}
            <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg border border-primary/30">
              <div>
                <p className="text-sm font-medium">Final Total</p>
                <p className="text-xs text-muted-foreground">Payment: {paymentMethod.toUpperCase()}</p>
              </div>
              <span className="text-2xl font-bold text-primary">{formatCurrency(cartTotal.total)}</span>
            </div>

            {/* Customer Details Toggle */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeCustomer"
                  checked={includeCustomerDetails}
                  onCheckedChange={(checked) => setIncludeCustomerDetails(checked === true)}
                />
                <Label htmlFor="includeCustomer">Add customer details to bill</Label>
              </div>

              {includeCustomerDetails && (
                <div className="grid gap-3 pl-6 animate-fade-in">
                  <div>
                    <Label htmlFor="customerName" className="text-xs">Name</Label>
                    <Input
                      id="customerName"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Customer name"
                      className="h-9"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="customerPhone" className="text-xs">Phone (with country code)</Label>
                      <Input
                        id="customerPhone"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="+1234567890"
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customerEmail" className="text-xs">Email</Label>
                      <Input
                        id="customerEmail"
                        type="email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        placeholder="email@example.com"
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="space-y-6">
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-scale-in">
                <Check className="w-8 h-8 text-success" />
              </div>
              <p className="text-lg font-semibold">Payment of {formatCurrency(finalPrice)} received!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Points earned: {cartTotal.pointsEarned}
              </p>
            </div>

            {/* Print Options */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Print Receipt?</Label>
                <Button
                  variant={showPrintOptions ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setShowPrintOptions(!showPrintOptions)}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  {showPrintOptions ? 'Hide Options' : 'Print Bill'}
                </Button>
              </div>

              {showPrintOptions && (
                <div className="p-4 bg-secondary/50 rounded-lg space-y-3 animate-fade-in">
                  <div>
                    <Label className="text-xs">Select Printer Type</Label>
                    <Select value={selectedPrinter} onValueChange={(v) => setSelectedPrinter(v as PrinterType)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(printerLayouts).map(([key, { name }]) => (
                          <SelectItem key={key} value={key}>{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handlePrint} className="w-full">
                    <Printer className="w-4 h-4 mr-2" />
                    Print with {printerLayouts[selectedPrinter].name}
                  </Button>
                </div>
              )}
            </div>

            {/* Send Notifications */}
            {includeCustomerDetails && (customerPhone || customerEmail) && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sendNotifications"
                    checked={sendNotifications}
                    onCheckedChange={(checked) => setSendNotifications(checked === true)}
                  />
                  <Label htmlFor="sendNotifications">Send bill to customer</Label>
                </div>

                {sendNotifications && (
                  <div className="p-4 bg-secondary/50 rounded-lg space-y-3 animate-fade-in">
                    <div className="flex flex-wrap gap-2">
                      {customerPhone && (
                        <div className="flex items-center gap-2 text-sm bg-green-500/10 text-green-600 px-3 py-1.5 rounded-full">
                          <MessageSquare className="w-4 h-4" />
                          WhatsApp: {customerPhone}
                        </div>
                      )}
                      {customerEmail && (
                        <div className="flex items-center gap-2 text-sm bg-blue-500/10 text-blue-600 px-3 py-1.5 rounded-full">
                          <Mail className="w-4 h-4" />
                          Email: {customerEmail}
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={handleSendNotifications}
                      disabled={isSendingNotification}
                      className="w-full"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {isSendingNotification ? 'Sending...' : 'Send Bill Now'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {step === 'review' ? (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              {paymentMethod === 'card' ? (
                <Button 
                  onClick={handleRazorpayPayment} 
                  disabled={isProcessing || isProcessingRazorpay}
                  className="bg-primary"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {isProcessingRazorpay ? 'Processing...' : `Pay ${formatCurrency(finalPrice)} with Razorpay`}
                </Button>
              ) : (
                <Button onClick={handleConfirmCheckout} disabled={isProcessing}>
                  {isProcessing ? 'Processing...' : `Confirm ${paymentMethod.toUpperCase()} Payment`}
                </Button>
              )}
            </>
          ) : (
            <Button onClick={handleClose} className="w-full">Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
