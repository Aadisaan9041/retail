import { useState } from 'react';
import { ArrowLeft, Save, CreditCard, CheckCircle2, XCircle, Loader2, Smartphone, Mail, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface PaymentSettingsProps {
  onBack: () => void;
}

interface PaymentSettingsData {
  enableRazorpay: boolean;
  razorpayKeyId: string;
  enablePayU: boolean;
  payuMerchantKey: string;
  enableUPI: boolean;
  enableCash: boolean;
  enableCard: boolean;
  storefrontUpiId: string;
  storefrontUpiName: string;
  adminEmail: string;
}

const defaultSettings: PaymentSettingsData = {
  enableRazorpay: true,
  razorpayKeyId: '',
  enablePayU: false,
  payuMerchantKey: '',
  enableUPI: true,
  enableCash: true,
  enableCard: true,
  storefrontUpiId: '',
  storefrontUpiName: '',
  adminEmail: '',
};

export function PaymentSettings({ onBack }: PaymentSettingsProps) {
  const { settings, updateField, saveSettings, isLoading, isSaving } = useSettings<PaymentSettingsData>(
    'paymentSettings',
    defaultSettings
  );
  const { toast } = useToast();
  const [isSendingSummary, setIsSendingSummary] = useState(false);

  const handleSendUPISummary = async () => {
    setIsSendingSummary(true);
    try {
      const { data, error } = await supabase.functions.invoke('daily-upi-summary', {
        body: { adminEmail: settings.adminEmail || undefined },
      });
      if (error) throw error;
      toast({
        title: 'Summary Sent',
        description: `Daily UPI report emailed. ${data?.stats?.total || 0} payments in last 24h.`,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to send UPI summary email.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingSummary(false);
    }
  };

  const handleSave = () => {
    saveSettings(settings);
    if (settings.razorpayKeyId) {
      localStorage.setItem('razorpayKeyId', settings.razorpayKeyId);
    }
  };

  const StatusBadge = ({ configured }: { configured: boolean }) => (
    <Badge variant="outline" className={configured ? 'badge-success' : 'badge-danger'}>
      {configured ? (
        <>
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Configured
        </>
      ) : (
        <>
          <XCircle className="w-3 h-3 mr-1" />
          Not Configured
        </>
      )}
    </Badge>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Payment Settings</h1>
          <p className="text-muted-foreground">Configure payment gateways</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Razorpay */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/20 text-primary">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Razorpay</h2>
                <p className="text-sm text-muted-foreground">Online payments</p>
              </div>
            </div>
            <StatusBadge configured={!!settings.razorpayKeyId} />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium">Enable Razorpay</p>
                <p className="text-sm text-muted-foreground">Accept card & UPI payments</p>
              </div>
              <Switch
                checked={settings.enableRazorpay}
                onCheckedChange={(checked) => updateField('enableRazorpay', checked)}
              />
            </div>

            <div className="space-y-2">
              <Label>Razorpay Key ID (Public)</Label>
              <Input
                value={settings.razorpayKeyId}
                onChange={(e) => updateField('razorpayKeyId', e.target.value)}
                placeholder="rzp_test_xxxxx or rzp_live_xxxxx"
                className="input-retail"
              />
              <p className="text-xs text-muted-foreground">
                This public key is used on the frontend. The secret key is securely stored.
              </p>
            </div>
          </div>
        </div>

        {/* PayU */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-accent/20 text-accent">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">PayU</h2>
                <p className="text-sm text-muted-foreground">Alternative gateway</p>
              </div>
            </div>
            <StatusBadge configured={!!settings.payuMerchantKey} />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium">Enable PayU</p>
                <p className="text-sm text-muted-foreground">Use PayU for payments</p>
              </div>
              <Switch
                checked={settings.enablePayU}
                onCheckedChange={(checked) => updateField('enablePayU', checked)}
              />
            </div>

            <div className="space-y-2">
              <Label>PayU Merchant Key (Public)</Label>
              <Input
                value={settings.payuMerchantKey}
                onChange={(e) => updateField('payuMerchantKey', e.target.value)}
                placeholder="Merchant Key"
                className="input-retail"
              />
            </div>
          </div>
        </div>

        {/* Storefront UPI Settings */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-success/20 text-success">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Storefront UPI</h2>
                <p className="text-sm text-muted-foreground">UPI for online orders</p>
              </div>
            </div>
            <StatusBadge configured={!!settings.storefrontUpiId} />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Storefront UPI ID</Label>
              <Input
                value={settings.storefrontUpiId}
                onChange={(e) => updateField('storefrontUpiId', e.target.value)}
                placeholder="store@upi"
                className="input-retail"
              />
              <p className="text-xs text-muted-foreground">
                UPI ID shown to customers on the webstore checkout
              </p>
            </div>

            <div className="space-y-2">
              <Label>Business Name (for UPI)</Label>
              <Input
                value={settings.storefrontUpiName}
                onChange={(e) => updateField('storefrontUpiName', e.target.value)}
                placeholder="Your Store Name"
                className="input-retail"
              />
              <p className="text-xs text-muted-foreground">
                Name displayed in customer's UPI app
              </p>
            </div>
          </div>
        </div>

        {/* Other Payment Methods */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Other Payment Methods</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium">Cash</p>
                <p className="text-sm text-muted-foreground">Accept cash at POS</p>
              </div>
              <Switch
                checked={settings.enableCash}
                onCheckedChange={(checked) => updateField('enableCash', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium">Card</p>
                <p className="text-sm text-muted-foreground">Card swipe at POS</p>
              </div>
              <Switch
                checked={settings.enableCard}
                onCheckedChange={(checked) => updateField('enableCard', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium">Direct UPI</p>
                <p className="text-sm text-muted-foreground">QR-based UPI</p>
              </div>
              <Switch
                checked={settings.enableUPI}
                onCheckedChange={(checked) => updateField('enableUPI', checked)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Admin Email & UPI Daily Summary */}
      <div className="p-4 rounded-lg border border-border bg-card space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary" />
            Admin Email for Reports
          </Label>
          <Input
            type="email"
            value={settings.adminEmail}
            onChange={(e) => updateField('adminEmail', e.target.value)}
            placeholder="admin@yourstore.com"
            className="input-retail max-w-md"
          />
          <p className="text-xs text-muted-foreground">
            Daily UPI summary and payment alerts will be sent to this email.
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            <h3 className="font-medium">UPI Daily Summary Email</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Send a summary of all UPI payments from the last 24 hours.
              Also runs automatically every day at 9:00 AM.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleSendUPISummary}
            disabled={isSendingSummary}
          >
            {isSendingSummary ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="w-4 h-4 mr-2" />
                Send Now
              </>
            )}
          </Button>
        </div>
      </div>

      {/* WhatsApp Business API */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 rounded-lg bg-green-500/20 text-green-600"><MessageCircle className="w-5 h-5" /></div>
          <div><h2 className="text-lg font-semibold">WhatsApp Notifications</h2><p className="text-sm text-muted-foreground">Credentials are managed securely in Integrations & API.</p></div>
        </div>
        <p className="text-sm text-muted-foreground">Use <strong>Settings → Integrations & API → WhatsApp</strong> for Business API credentials. Secrets are not stored in the general payment settings record.</p>
      </div>

      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-4 h-4 mr-2" />
            Save Payment Settings
          </>
        )}
      </Button>
    </div>
  );
}
