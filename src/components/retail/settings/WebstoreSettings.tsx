import { ArrowLeft, Save, Store, Image, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useSettings } from '@/hooks/useSettings';

interface WebstoreSettingsProps {
  onBack: () => void;
}

interface WebstoreSettingsData {
  storeName: string;
  storeDescription: string;
  logoUrl: string;
  bannerUrl: string;
  enableGuestCheckout: boolean;
  requirePhone: boolean;
  showTaxOnProducts: boolean;
  enableCOD: boolean;
  webstoreUpiId: string;
}

const defaultSettings: WebstoreSettingsData = {
  storeName: '',
  storeDescription: '',
  logoUrl: '',
  bannerUrl: '',
  enableGuestCheckout: true,
  requirePhone: true,
  showTaxOnProducts: true,
  enableCOD: false,
  webstoreUpiId: '',
};

export function WebstoreSettings({ onBack }: WebstoreSettingsProps) {
  const { settings, updateField, saveSettings, isLoading, isSaving } = useSettings<WebstoreSettingsData>(
    'webstoreSettings',
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
          <h1 className="text-2xl font-bold">Webstore Settings</h1>
          <p className="text-muted-foreground">Configure your online store</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Store Branding */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-lg bg-accent/20 text-accent">
              <Store className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold">Store Branding</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Store Name</Label>
              <Input
                value={settings.storeName}
                onChange={(e) => updateField('storeName', e.target.value)}
                placeholder="My Awesome Store"
                className="input-retail"
              />
            </div>

            <div className="space-y-2">
              <Label>Store Description</Label>
              <Textarea
                value={settings.storeDescription}
                onChange={(e) => updateField('storeDescription', e.target.value)}
                placeholder="Tell customers about your store..."
                className="input-retail min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label>Logo URL</Label>
              <Input
                value={settings.logoUrl}
                onChange={(e) => updateField('logoUrl', e.target.value)}
                placeholder="https://..."
                className="input-retail"
              />
            </div>

            <div className="space-y-2">
              <Label>Banner URL</Label>
              <Input
                value={settings.bannerUrl}
                onChange={(e) => updateField('bannerUrl', e.target.value)}
                placeholder="https://..."
                className="input-retail"
              />
            </div>
          </div>
        </div>

        {/* Checkout Settings */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-lg bg-primary/20 text-primary">
              <Image className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold">Checkout Options</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium">Guest Checkout</p>
                <p className="text-sm text-muted-foreground">Allow orders without login</p>
              </div>
              <Switch
                checked={settings.enableGuestCheckout}
                onCheckedChange={(checked) => updateField('enableGuestCheckout', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium">Require Phone</p>
                <p className="text-sm text-muted-foreground">Phone number mandatory</p>
              </div>
              <Switch
                checked={settings.requirePhone}
                onCheckedChange={(checked) => updateField('requirePhone', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium">Show Tax on Products</p>
                <p className="text-sm text-muted-foreground">Display tax info on product pages</p>
              </div>
              <Switch
                checked={settings.showTaxOnProducts}
                onCheckedChange={(checked) => updateField('showTaxOnProducts', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium">Cash on Delivery</p>
                <p className="text-sm text-muted-foreground">Allow COD payment option</p>
              </div>
              <Switch
                checked={settings.enableCOD}
                onCheckedChange={(checked) => updateField('enableCOD', checked)}
              />
            </div>

            <div className="space-y-2">
              <Label>Webstore UPI ID</Label>
              <Input
                value={settings.webstoreUpiId}
                onChange={(e) => updateField('webstoreUpiId', e.target.value)}
                placeholder="webstore@upi"
                className="input-retail"
              />
              <p className="text-xs text-muted-foreground">
                Separate UPI ID for webstore payments
              </p>
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
            Save Webstore Settings
          </>
        )}
      </Button>
    </div>
  );
}
