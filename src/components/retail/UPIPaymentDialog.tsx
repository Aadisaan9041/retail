import { useState } from 'react';
import { Smartphone, Check, X, Copy, ExternalLink, Shield, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useUPIPayment } from '@/hooks/useUPIPayment';
import { useToast } from '@/hooks/use-toast';
import { usePaymentConfig } from '@/hooks/usePaymentSettings';
import { supabase } from '@/integrations/supabase/client';

interface UPIPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  onPaymentConfirmed: () => void;
  merchantVPA?: string;
  merchantName?: string;
  orderId?: string;
}

export function UPIPaymentDialog({
  isOpen,
  onClose,
  amount,
  onPaymentConfirmed,
  merchantVPA: propVPA,
  merchantName: propName,
  orderId,
}: UPIPaymentDialogProps) {
  const [transactionId, setTransactionId] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);
  const [verifiedViaApp, setVerifiedViaApp] = useState(false);
  const { getQRCodeUrl, initiateUPIPayment, openBusinessApp } = useUPIPayment();
  const { toast } = useToast();
  const { config } = usePaymentConfig();

  const vpa = propVPA || config.posUpiId;
  const name = propName || config.posUpiName || 'Store';
  const transactionRef = `TXN${Date.now()}`;

  const qrCodeUrl = vpa ? getQRCodeUrl({
    amount,
    merchantVPA: vpa,
    merchantName: name,
    transactionNote: `Payment at ${name}`,
    transactionRef,
  }) : '';

  const copyUPIId = () => {
    navigator.clipboard.writeText(vpa);
    toast({ title: 'Copied!', description: 'UPI ID copied to clipboard' });
  };

  const openUPIApp = async () => {
    await initiateUPIPayment({
      amount,
      merchantVPA: vpa,
      merchantName: name,
      transactionNote: `Payment at ${name}`,
      transactionRef,
    });
  };

  const handleOpenBusinessApp = () => {
    openBusinessApp({
      merchantVPA: vpa,
      merchantName: name,
      amount,
      transactionRef,
    });

    // After opening the business app, show a confirmation prompt
    // The admin can confirm after checking payment in their app
    setTimeout(() => {
      setVerifiedViaApp(true);
    }, 2000);
  };

  const handleConfirmPayment = async () => {
    setIsConfirming(true);
    try {
      // Record the verification in the database
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('upi_payment_verifications').insert({
        transaction_ref: transactionRef,
        utr_number: transactionId || null,
        amount,
        merchant_vpa: vpa,
        status: 'verified',
        verified_by: user?.id || null,
        verified_at: new Date().toISOString(),
        order_id: orderId || null,
      });

      // If linked to an order, update order status
      if (orderId) {
        await supabase
          .from('orders')
          .update({ status: 'confirmed' })
          .eq('id', orderId);
      }

      onPaymentConfirmed();
      onClose();
      toast({ title: 'Payment Confirmed', description: 'UPI payment has been verified and recorded.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to record payment verification.', variant: 'destructive' });
    } finally {
      setIsConfirming(false);
      setVerifiedViaApp(false);
    }
  };

  if (!vpa) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5" />
              UPI Payment Setup Required
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 text-center">
            <p className="text-muted-foreground mb-4">
              Please configure your UPI payment settings in the Settings page first.
            </p>
            <Button onClick={onClose}>Go to Settings</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            UPI Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/30">
            <p className="text-sm text-muted-foreground">Amount to Pay</p>
            <p className="text-3xl font-bold text-primary">{formatCurrency(amount)}</p>
          </div>

          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-lg">
              <img src={qrCodeUrl} alt="UPI QR Code" className="w-48 h-48" />
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Pay to UPI ID</p>
              <p className="font-mono text-sm font-medium">{vpa}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={copyUPIId}>
              <Copy className="w-4 h-4" />
            </Button>
          </div>

          <Button variant="outline" className="w-full" onClick={openUPIApp}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Open Customer's UPI App
          </Button>

          <div className="space-y-2">
            <Label htmlFor="transactionId" className="text-xs">
              Transaction Reference / UTR (optional)
            </Label>
            <Input
              id="transactionId"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="Enter UTR/Transaction ID for records"
              className="h-9"
            />
          </div>

          {/* Verify via Business App - primary action for admin devices */}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full border-primary/30 text-primary hover:bg-primary/10"
              onClick={handleOpenBusinessApp}
            >
              <Shield className="w-4 h-4 mr-2" />
              Open UPI Business App to Verify
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Opens your PhonePe Business / GPay Business / Paytm Business app to check incoming payment
            </p>
          </div>

          {verifiedViaApp && (
            <div className="p-3 rounded-lg bg-success/10 border border-success/30 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-success">Did you verify the payment in your business app?</p>
                <p className="text-xs text-muted-foreground">If confirmed, click "Payment Verified" below</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleConfirmPayment}
            disabled={isConfirming}
            className="flex-1 bg-success hover:bg-success/90"
          >
            <Check className="w-4 h-4 mr-2" />
            {isConfirming ? 'Confirming...' : 'Payment Verified'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
