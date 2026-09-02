import { useState, useEffect } from 'react';
import { Check, X, Clock, Smartphone, RefreshCw, Download, Mail, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UPIStatementMatcher } from './UPIStatementMatcher';
import { useCurrency } from '@/hooks/useCurrency';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

interface UPIVerification {
  id: string;
  order_id: string | null;
  transaction_ref: string;
  utr_number: string | null;
  amount: number;
  payer_vpa: string | null;
  merchant_vpa: string;
  status: string;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
}

export function UPIVerificationPanel() {
  const [verifications, setVerifications] = useState<UPIVerification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState<UPIVerification | null>(null);
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [sendReceipt, setSendReceipt] = useState(true);
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  const fetchVerifications = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('upi_payment_verifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching verifications:', error);
    } else {
      setVerifications(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchVerifications();

    const channel = supabase
      .channel('upi-verifications-admin')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'upi_payment_verifications' },
        () => { fetchVerifications(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const getStoreName = async (): Promise<string> => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'appSettings')
      .maybeSingle();
    return (data?.value as any)?.storeName || 'Our Store';
  };

  const getAdminEmail = async (): Promise<string | undefined> => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'paymentSettings')
      .maybeSingle();
    return (data?.value as any)?.adminEmail;
  };

  const sendStatusEmail = async (verification: UPIVerification, newStatus: string) => {
    try {
      const adminEmail = await getAdminEmail();
      await supabase.functions.invoke('upi-verification-status', {
        body: {
          amount: verification.amount,
          transactionRef: verification.transaction_ref,
          utrNumber: verification.utr_number,
          payerVpa: verification.payer_vpa,
          status: newStatus,
          adminEmail,
        },
      });
    } catch (err) {
      console.error('Status email failed:', err);
    }
  };

  const sendReceiptEmail = async (verification: UPIVerification, email: string) => {
    try {
      const storeName = await getStoreName();
      await supabase.functions.invoke('upi-payment-receipt', {
        body: {
          customerEmail: email,
          amount: verification.amount,
          transactionRef: verification.transaction_ref,
          utrNumber: verification.utr_number,
          payerVpa: verification.payer_vpa,
          merchantVpa: verification.merchant_vpa,
          orderId: verification.order_id,
          storeName,
        },
      });
      toast({ title: '📧 Receipt Sent', description: `Payment receipt emailed to ${email}` });
    } catch (err) {
      console.error('Receipt email failed:', err);
      toast({ title: 'Receipt Failed', description: 'Could not send receipt email.', variant: 'destructive' });
    }
  };

  const sendWhatsAppAlert = async (verification: UPIVerification, phone: string, type: string) => {
    try {
      const storeName = await getStoreName();
      const { data } = await supabase.functions.invoke('whatsapp-upi-alert', {
        body: {
          phoneNumber: phone,
          type,
          amount: verification.amount,
          transactionRef: verification.transaction_ref,
          utrNumber: verification.utr_number,
          storeName,
        },
      });

      if (data?.method === 'wa_link') {
        // API not configured — open wa.me link on admin's device
        window.open(data.waLink, '_blank');
        toast({ title: '💬 WhatsApp Opened', description: 'Message pre-filled. Tap send in WhatsApp.' });
      } else if (data?.success) {
        toast({ title: '💬 WhatsApp Sent', description: `Notification sent to ${phone}` });
      }
    } catch (err) {
      console.error('WhatsApp alert failed:', err);
      toast({ title: 'WhatsApp Failed', description: 'Could not send WhatsApp message.', variant: 'destructive' });
    }
  };

  const openVerifyDialog = async (verification: UPIVerification) => {
    setSelectedVerification(verification);
    setCustomerEmail('');
    setCustomerPhone('');

    // Auto-fill from order if available
    if (verification.order_id) {
      const { data: order } = await supabase
        .from('orders')
        .select('customer_email, customer_phone')
        .eq('id', verification.order_id)
        .maybeSingle();

      if (order) {
        setCustomerEmail(order.customer_email || '');
        setCustomerPhone(order.customer_phone || '');
      }
    }

    setVerifyDialogOpen(true);
  };

  const handleConfirmVerify = async () => {
    if (!selectedVerification) return;
    setIsSending(true);
    const id = selectedVerification.id;

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('upi_payment_verifications')
      .update({
        status: 'verified',
        verified_by: user?.id || null,
        verified_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to verify payment.', variant: 'destructive' });
    } else {
      toast({ title: 'Payment Verified', description: 'The UPI payment has been confirmed.' });

      // Send admin notification email
      sendStatusEmail(selectedVerification, 'verified');

      // Send customer receipt email
      if (sendReceipt && customerEmail) {
        await sendReceiptEmail(selectedVerification, customerEmail);
      }

      // Send WhatsApp notification
      if (sendWhatsApp && customerPhone) {
        await sendWhatsAppAlert(selectedVerification, customerPhone, 'receipt');
      }

      // Update order status
      if (selectedVerification.order_id) {
        await supabase
          .from('orders')
          .update({ status: 'confirmed' })
          .eq('id', selectedVerification.order_id);
      }
    }

    setIsSending(false);
    setVerifyDialogOpen(false);
  };

  const handleReject = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('upi_payment_verifications')
      .update({
        status: 'rejected',
        verified_by: user?.id || null,
        verified_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to reject payment.', variant: 'destructive' });
    } else {
      toast({ title: 'Payment Rejected', description: 'The UPI payment has been rejected.' });
      const verification = verifications.find(v => v.id === id);
      if (verification) sendStatusEmail(verification, 'rejected');
    }
  };

  const handleExport = (type: 'csv' | 'excel') => {
    if (verifications.length === 0) {
      toast({ title: 'No Data', description: 'No verifications to export.' });
      return;
    }

    const exportData = verifications.map((v) => ({
      Date: format(new Date(v.created_at), 'yyyy-MM-dd HH:mm:ss'),
      'Transaction Ref': v.transaction_ref,
      'UTR Number': v.utr_number || '',
      Amount: v.amount,
      'Payer VPA': v.payer_vpa || '',
      'Merchant VPA': v.merchant_vpa,
      Status: v.status,
      'Verified At': v.verified_at ? format(new Date(v.verified_at), 'yyyy-MM-dd HH:mm:ss') : '',
      'Order ID': v.order_id || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'UPI Verifications');

    const filename = `upi-verifications-${format(new Date(), 'yyyy-MM-dd')}`;

    if (type === 'csv') {
      XLSX.writeFile(wb, `${filename}.csv`, { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, `${filename}.xlsx`);
    }

    toast({ title: 'Exported', description: `UPI verification data exported as ${type.toUpperCase()}.` });
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="badge-warning"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'verified':
        return <Badge variant="outline" className="badge-success"><Check className="w-3 h-3 mr-1" />Verified</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="badge-danger"><X className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCount = verifications.filter(v => v.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20 text-primary">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold">UPI Payment Verifications</h3>
            <p className="text-sm text-muted-foreground">
              {pendingCount > 0 ? `${pendingCount} pending verification${pendingCount > 1 ? 's' : ''}` : 'No pending verifications'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <UPIStatementMatcher />
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={verifications.length === 0}>
            <Download className="w-4 h-4 mr-1" />CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport('excel')} disabled={verifications.length === 0}>
            <Download className="w-4 h-4 mr-1" />Excel
          </Button>
          <Button variant="outline" size="sm" onClick={fetchVerifications} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />Refresh
          </Button>
        </div>
      </div>

      {verifications.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Smartphone className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>No UPI payment verifications yet</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>UTR Number</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {verifications.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="text-sm">
                    {format(new Date(v.created_at), 'dd MMM, HH:mm')}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{v.utr_number || '-'}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(v.amount)}</TableCell>
                  <TableCell className="text-sm">{v.payer_vpa || '-'}</TableCell>
                  <TableCell>{statusBadge(v.status)}</TableCell>
                  <TableCell className="text-right">
                    {v.status === 'pending' && (
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs text-success border-success/30 hover:bg-success/10" onClick={() => openVerifyDialog(v)}>
                          <Check className="w-3 h-3 mr-1" /> Verify
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleReject(v.id)}>
                          <X className="w-3 h-3 mr-1" /> Reject
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Verify & Send Receipt Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Payment & Send Receipt</DialogTitle>
          </DialogHeader>
          {selectedVerification && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold">{formatCurrency(selectedVerification.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">UTR</span>
                  <span className="font-mono">{selectedVerification.utr_number || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ref</span>
                  <span className="font-mono text-xs">{selectedVerification.transaction_ref}</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="send-receipt"
                    checked={sendReceipt}
                    onChange={(e) => setSendReceipt(e.target.checked)}
                    className="rounded border-border"
                  />
                  <label htmlFor="send-receipt" className="text-sm flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" /> Email receipt to customer
                  </label>
                </div>
                {sendReceipt && (
                  <Input
                    placeholder="Customer email address"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                  />
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="send-whatsapp"
                    checked={sendWhatsApp}
                    onChange={(e) => setSendWhatsApp(e.target.checked)}
                    className="rounded border-border"
                  />
                  <label htmlFor="send-whatsapp" className="text-sm flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp receipt to customer
                  </label>
                </div>
                {sendWhatsApp && (
                  <Input
                    placeholder="Customer phone (e.g., 9876543210)"
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleConfirmVerify} disabled={isSending} className="bg-success hover:bg-success/90 text-success-foreground">
              {isSending ? 'Verifying...' : '✅ Verify & Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
