import { useState, useEffect } from 'react';
import { CreditCard, Smartphone, Wallet, Check, X, QrCode, Copy, Loader2, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useUPIPayment } from '@/hooks/useUPIPayment';
import { usePayU } from '@/hooks/usePayU';
import { useRazorpay } from '@/hooks/useRazorpay';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/useCurrency';
import { usePaymentConfig } from '@/hooks/usePaymentSettings';
import { supabase } from '@/integrations/supabase/client';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  onPaymentComplete: (method: 'card' | 'upi' | 'wallet') => void;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  orderId?: string;
}

export function PaymentDialog({
  isOpen,
  onClose,
  amount,
  onPaymentComplete,
  customerName = '',
  customerEmail = '',
  customerPhone = '',
  orderId,
}: PaymentDialogProps) {
  const [activeTab, setActiveTab] = useState<'card' | 'upi' | 'wallet'>('upi');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showUPIQR, setShowUPIQR] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  
  const { generateUPILink, getQRCodeUrl } = useUPIPayment();
  const { simulatePayment } = usePayU();
  const { initiatePayment, isLoading: razorpayLoading } = useRazorpay();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { config } = usePaymentConfig();

  const merchantVPA = config.storefrontUpiId;
  const merchantName = config.storefrontUpiName || 'Store';
  const transactionRef = `TXN${Date.now()}`;

  const qrCodeUrl = merchantVPA ? getQRCodeUrl({
    amount,
    merchantVPA,
    merchantName,
    transactionNote: `Order at ${merchantName}`,
  }) : '';

  // Listen for realtime verification updates
  useEffect(() => {
    if (!verificationId) return;

    const channel = supabase
      .channel(`upi-verify-${verificationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'upi_payment_verifications',
          filter: `id=eq.${verificationId}`,
        },
        (payload) => {
          const newStatus = (payload.new as any).status;
          setVerificationStatus(newStatus);
          if (newStatus === 'verified') {
            toast({ title: 'Payment Verified!', description: 'Your payment has been confirmed.' });
            onPaymentComplete('upi');
            onClose();
          } else if (newStatus === 'rejected') {
            toast({ title: 'Payment Rejected', description: 'The payment could not be verified. Please try again.', variant: 'destructive' });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [verificationId, onPaymentComplete, onClose, toast]);

  const handleRazorpayPayment = async () => {
    setIsProcessing(true);
    await initiatePayment(
      {
        amount,
        currency: 'INR',
        description: 'Store Purchase',
        customerName,
        customerEmail,
        customerPhone,
        notes: { source: 'webstore' },
      },
      () => {
        onPaymentComplete('card');
        onClose();
        setIsProcessing(false);
      },
      (error) => {
        console.error('Razorpay error:', error);
        setIsProcessing(false);
      }
    );
  };

  const handleSubmitUPIVerification = async () => {
    if (!utrNumber.trim()) {
      toast({ title: 'UTR Required', description: 'Please enter the UTR/transaction reference number from your UPI app.', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase
        .from('upi_payment_verifications')
        .insert({
          order_id: orderId || null,
          transaction_ref: transactionRef,
          utr_number: utrNumber.trim(),
          amount,
          payer_vpa: upiId || null,
          merchant_vpa: merchantVPA,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) throw error;

      setVerificationId(data.id);
      setVerificationStatus('pending');
      toast({
        title: 'Verification Submitted',
        description: 'Your payment is being verified. You will be notified once confirmed.',
      });
    } catch (err) {
      console.error('Error submitting verification:', err);
      toast({ title: 'Error', description: 'Failed to submit verification. Please try again.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const copyUPIId = () => {
    navigator.clipboard.writeText(merchantVPA);
    toast({ title: 'Copied!', description: 'UPI ID copied to clipboard' });
  };

  const handleWalletPayment = async () => {
    setIsProcessing(true);
    setTimeout(() => {
      toast({ title: 'Wallet Payment', description: 'Redirecting to wallet...' });
      onPaymentComplete('wallet');
      onClose();
      setIsProcessing(false);
    }, 1500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Payment
          </DialogTitle>
        </DialogHeader>

        <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/30 mb-4">
          <p className="text-sm text-muted-foreground">Amount to Pay</p>
          <p className="text-3xl font-bold text-primary">{formatCurrency(amount)}</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="upi" className="flex items-center gap-1">
              <Smartphone className="w-4 h-4" />
              <span className="hidden sm:inline">UPI</span>
            </TabsTrigger>
            <TabsTrigger value="card" className="flex items-center gap-1">
              <CreditCard className="w-4 h-4" />
              <span className="hidden sm:inline">Card</span>
            </TabsTrigger>
            <TabsTrigger value="wallet" className="flex items-center gap-1">
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">Wallet</span>
            </TabsTrigger>
          </TabsList>

          {/* UPI Tab */}
          <TabsContent value="upi" className="space-y-4 mt-4">
            {!merchantVPA ? (
              <div className="text-center py-6">
                <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">UPI payments are not configured yet. Please contact the store.</p>
              </div>
            ) : verificationStatus === 'pending' ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto">
                  <Clock className="w-8 h-8 text-warning animate-pulse" />
                </div>
                <h4 className="font-semibold">Payment Verification Pending</h4>
                <p className="text-sm text-muted-foreground">
                  Your UTR <span className="font-mono font-medium">{utrNumber}</span> has been submitted.
                  The store will verify and confirm your payment shortly.
                </p>
                <p className="text-xs text-muted-foreground">You'll be notified automatically once verified.</p>
              </div>
            ) : !showUPIQR ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="upiId">Enter UPI ID (optional)</Label>
                  <Input
                    id="upiId"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="yourname@upi"
                    className="h-11"
                  />
                </div>
                <div className="text-center text-muted-foreground text-sm">- OR -</div>
                <Button variant="outline" className="w-full h-11" onClick={() => setShowUPIQR(true)}>
                  <QrCode className="w-4 h-4 mr-2" />
                  Scan QR Code to Pay
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-lg">
                    <img src={qrCodeUrl} alt="UPI QR Code" className="w-48 h-48" />
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Pay to UPI ID</p>
                    <p className="font-mono text-sm font-medium">{merchantVPA}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={copyUPIId}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>

                <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg">
                  <p className="text-sm font-medium mb-2">After paying, enter your UTR number:</p>
                  <Input
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    placeholder="Enter 12-digit UTR number"
                    className="h-10 mb-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Find the UTR/Reference number in your UPI app's transaction details
                  </p>
                </div>

                <Button
                  className="w-full h-11"
                  onClick={handleSubmitUPIVerification}
                  disabled={isProcessing || !utrNumber.trim()}
                >
                  {isProcessing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
                  ) : (
                    <><Check className="w-4 h-4 mr-2" /> Submit for Verification</>
                  )}
                </Button>

                <Button variant="ghost" className="w-full" onClick={() => setShowUPIQR(false)}>
                  Back
                </Button>
              </div>
            )}

            {!showUPIQR && !verificationStatus && merchantVPA && (
              <Button
                className="w-full h-11"
                onClick={() => setShowUPIQR(true)}
                disabled={isProcessing}
              >
                Proceed to Pay
              </Button>
            )}
          </TabsContent>

          {/* Card Tab */}
          <TabsContent value="card" className="space-y-4 mt-4">
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-primary" />
              </div>
              <h4 className="font-semibold mb-2">Pay with Card via Razorpay</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Secure payment powered by Razorpay. Supports all major cards, netbanking, and wallets.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {['Visa', 'Mastercard', 'Rupay', 'Netbanking'].map((method) => (
                  <span key={method} className="px-3 py-1 bg-secondary text-xs rounded-full">{method}</span>
                ))}
              </div>
            </div>
            <div className="p-3 bg-secondary/50 rounded-lg text-xs text-muted-foreground">
              <p>🔒 Your payment is secured with Razorpay's 256-bit encryption</p>
            </div>
            <Button className="w-full h-12" onClick={handleRazorpayPayment} disabled={isProcessing || razorpayLoading}>
              {isProcessing || razorpayLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
              ) : (
                <><CreditCard className="w-4 h-4 mr-2" /> Pay {formatCurrency(amount)} with Razorpay</>
              )}
            </Button>
          </TabsContent>

          {/* Wallet Tab */}
          <TabsContent value="wallet" className="space-y-4 mt-4">
            <div className="space-y-3">
              {['Paytm Wallet', 'PhonePe Wallet', 'Amazon Pay', 'Mobikwik'].map((wallet) => (
                <Button key={wallet} variant="outline" className="w-full h-12 justify-start" onClick={handleWalletPayment} disabled={isProcessing}>
                  <Wallet className="w-5 h-5 mr-3" />
                  {wallet}
                </Button>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
