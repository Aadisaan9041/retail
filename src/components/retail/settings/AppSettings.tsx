import { ArrowLeft, Save, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/hooks/useSettings';

interface AppSettingsProps {
  onBack: () => void;
}

interface AppSettingsData {
  appName: string;
  contactEmail: string;
  contactPhone: string;
  currency: string;
  language: string;
  invoicePrefix: string;
  invoiceStartNumber: number;
  enableLoyalty: boolean;
  enableReorders: boolean;
  priceOverrideThreshold: number;
  priceOverrideNotificationEmail: string;
  originPincode: string;
}

const defaultSettings: AppSettingsData = {
  appName: 'My Store',
  contactEmail: '',
  contactPhone: '',
  currency: 'INR',
  language: 'en',
  invoicePrefix: 'INV',
  invoiceStartNumber: 1001,
  enableLoyalty: true,
  enableReorders: true,
  priceOverrideThreshold: 20,
  priceOverrideNotificationEmail: '',
  originPincode: '110001',
};

export function AppSettings({ onBack }: AppSettingsProps) {
  const { settings, updateField, saveSettings, isLoading, isSaving } = useSettings<AppSettingsData>(
    'appSettings',
    defaultSettings
  );

  const handleSave = () => {
    saveSettings(settings);
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
          <h1 className="text-2xl font-bold">App Settings</h1>
          <p className="text-muted-foreground">Configure application preferences</p>
        </div>
      </div>

      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-primary/20 text-primary">
            <Settings className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-semibold">General Settings</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>App Name</Label>
            <Input
              value={settings.appName}
              onChange={(e) => updateField('appName', e.target.value)}
              className="input-retail"
            />
          </div>

          <div className="space-y-2">
            <Label>Contact Email</Label>
            <Input
              type="email"
              value={settings.contactEmail}
              onChange={(e) => updateField('contactEmail', e.target.value)}
              placeholder="support@store.com"
              className="input-retail"
            />
          </div>

          <div className="space-y-2">
            <Label>Contact Phone</Label>
            <Input
              value={settings.contactPhone}
              onChange={(e) => updateField('contactPhone', e.target.value)}
              placeholder="+91 XXXXX XXXXX"
              className="input-retail"
            />
          </div>

          <div className="space-y-2">
            <Label>Currency</Label>
            <Select
              value={settings.currency}
              onValueChange={(value) => updateField('currency', value)}
            >
              <SelectTrigger className="input-retail">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">₹ Indian Rupee (INR)</SelectItem>
                <SelectItem value="USD">$ US Dollar (USD)</SelectItem>
                <SelectItem value="EUR">€ Euro (EUR)</SelectItem>
                <SelectItem value="GBP">£ British Pound (GBP)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Invoice Prefix</Label>
            <Input
              value={settings.invoicePrefix}
              onChange={(e) => updateField('invoicePrefix', e.target.value)}
              className="input-retail"
            />
          </div>

          <div className="space-y-2">
            <Label>Invoice Start Number</Label>
            <Input
              type="number"
              value={settings.invoiceStartNumber}
              onChange={(e) => updateField('invoiceStartNumber', parseInt(e.target.value) || 1)}
              className="input-retail"
            />
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border space-y-4">
          <h3 className="font-semibold">Price Override Fraud Prevention</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Override Threshold (%)</Label>
              <Input
                type="number"
                value={settings.priceOverrideThreshold}
                onChange={(e) => updateField('priceOverrideThreshold', parseInt(e.target.value) || 0)}
                placeholder="20"
                className="input-retail"
              />
              <p className="text-xs text-muted-foreground">
                Alert when price is modified by more than this percentage
              </p>
            </div>

            <div className="space-y-2">
              <Label>Notification Email</Label>
              <Input
                type="email"
                value={settings.priceOverrideNotificationEmail}
                onChange={(e) => updateField('priceOverrideNotificationEmail', e.target.value)}
                placeholder="admin@store.com"
                className="input-retail"
              />
              <p className="text-xs text-muted-foreground">
                Email to receive fraud prevention alerts
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border space-y-4">
          <h3 className="font-semibold">Shipping</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Origin Pincode</Label>
              <Input
                value={settings.originPincode}
                onChange={(e) => updateField('originPincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="110001"
                maxLength={6}
                className="input-retail"
              />
              <p className="text-xs text-muted-foreground">
                Store/warehouse pincode used for shipping rate calculations
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border space-y-4">
          <h3 className="font-semibold">Modules</h3>
          
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <div>
              <p className="font-medium">Loyalty Program</p>
              <p className="text-sm text-muted-foreground">Enable customer loyalty points</p>
            </div>
            <Switch
              checked={settings.enableLoyalty}
              onCheckedChange={(checked) => updateField('enableLoyalty', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <div>
              <p className="font-medium">Auto Reorders</p>
              <p className="text-sm text-muted-foreground">Automatic low stock reorder requests</p>
            </div>
            <Switch
              checked={settings.enableReorders}
              onCheckedChange={(checked) => updateField('enableReorders', checked)}
            />
          </div>
        </div>

        <Button onClick={handleSave} className="mt-6" disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
