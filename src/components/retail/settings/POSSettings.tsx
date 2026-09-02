import { ArrowLeft, Save, Monitor, Link, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/hooks/useSettings';
import { supabase } from '@/integrations/supabase/client';

interface POSSettingsProps {
  onBack: () => void;
}

interface POSSettingsData {
  enablePriceOverride: boolean;
  priceOverrideRole: 'admin' | 'manager' | 'both';
  receiptFormat: 'standard' | 'compact' | 'detailed';
  posUpiId: string;
  posUpiName: string;
  showQrOnCheckout: boolean;
  enableSoundEffects: boolean;
  minimumBillGrossProfit: number;
}

const defaultSettings: POSSettingsData = {
  enablePriceOverride: true,
  priceOverrideRole: 'both',
  receiptFormat: 'standard',
  posUpiId: '',
  posUpiName: '',
  showQrOnCheckout: true,
  enableSoundEffects: true,
  minimumBillGrossProfit: 0,
};

export function POSSettings({ onBack }: POSSettingsProps) {
  const { settings, updateField, saveSettings, isLoading, isSaving } = useSettings<POSSettingsData>(
    'posSettings',
    defaultSettings
  );

  const handleSave = async () => {
    await saveSettings(settings);
    await supabase.from('app_settings').upsert(
      { key: 'minimum_bill_gross_profit', value: { amount: Math.max(0, Number(settings.minimumBillGrossProfit) || 0) } },
      { onConflict: 'key' }
    );
  };

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
          <h1 className="text-2xl font-bold">POS Settings</h1>
          <p className="text-muted-foreground">Configure point of sale behavior</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Checkout Settings */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-lg bg-primary/20 text-primary">
              <Monitor className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold">Checkout Settings</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium">Enable Price Override</p>
                <p className="text-sm text-muted-foreground">Allow price modification at checkout</p>
              </div>
              <Switch
                checked={settings.enablePriceOverride}
                onCheckedChange={(checked) => updateField('enablePriceOverride', checked)}
              />
            </div>

            {settings.enablePriceOverride && (
              <div className="space-y-2">
                <Label>Price Override Permission</Label>
                <Select
                  value={settings.priceOverrideRole}
                  onValueChange={(value: 'admin' | 'manager' | 'both') => 
                    updateField('priceOverrideRole', value)}
                >
                  <SelectTrigger className="input-retail">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin Only</SelectItem>
                    <SelectItem value="manager">Manager Only</SelectItem>
                    <SelectItem value="both">Admin & Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2 p-3 rounded-lg bg-secondary/50">
              <Label>Minimum Gross Profit Per Bill</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={settings.minimumBillGrossProfit}
                onChange={(e) => updateField('minimumBillGrossProfit', Math.max(0, Number(e.target.value) || 0))}
                className="input-retail"
              />
              <p className="text-xs text-muted-foreground">A single item may be below cost, but final billing is blocked if the complete bill falls below this gross-profit floor.</p>
            </div>

            <div className="space-y-2">
              <Label>Receipt Format</Label>
              <Select
                value={settings.receiptFormat}
                onValueChange={(value: 'standard' | 'compact' | 'detailed') => 
                  updateField('receiptFormat', value)}
              >
                <SelectTrigger className="input-retail">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="compact">Compact</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium">Sound Effects</p>
                <p className="text-sm text-muted-foreground">Play sounds on actions</p>
              </div>
              <Switch
                checked={settings.enableSoundEffects}
                onCheckedChange={(checked) => updateField('enableSoundEffects', checked)}
              />
            </div>
          </div>
        </div>

        {/* POS UPI Settings */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-lg bg-success/20 text-success">
              <Link className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold">POS UPI Settings</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>POS UPI ID</Label>
              <Input
                value={settings.posUpiId}
                onChange={(e) => updateField('posUpiId', e.target.value)}
                placeholder="store@upi"
                className="input-retail"
              />
              <p className="text-xs text-muted-foreground">
                UPI ID for receiving payments at POS
              </p>
            </div>

            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input
                value={settings.posUpiName}
                onChange={(e) => updateField('posUpiName', e.target.value)}
                placeholder="Your Store Name"
                className="input-retail"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium">Show QR on Checkout</p>
                <p className="text-sm text-muted-foreground">Display UPI QR code during payment</p>
              </div>
              <Switch
                checked={settings.showQrOnCheckout}
                onCheckedChange={(checked) => updateField('showQrOnCheckout', checked)}
              />
            </div>
          </div>
        </div>
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
            Save POS Settings
          </>
        )}
      </Button>
    </div>
  );
}
