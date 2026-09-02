import { useState } from 'react';
import { ArrowLeft, Save, Receipt, Plus, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSettings } from '@/hooks/useSettings';

interface TaxSettingsProps {
  onBack: () => void;
}

interface TaxSlab {
  id: string;
  name: string;
  rate: number;
  type: 'percentage' | 'fixed';
}

interface TaxSettingsData {
  enableTax: boolean;
  taxInclusive: boolean;
  defaultTaxRate: number;
  gstEnabled: boolean;
  cgstRate: number;
  sgstRate: number;
  taxSlabs: TaxSlab[];
  allowPosOverride: boolean;
}

const defaultSettings: TaxSettingsData = {
  enableTax: true,
  taxInclusive: false,
  defaultTaxRate: 18,
  gstEnabled: true,
  cgstRate: 9,
  sgstRate: 9,
  taxSlabs: [
    { id: '1', name: 'GST 5%', rate: 5, type: 'percentage' },
    { id: '2', name: 'GST 12%', rate: 12, type: 'percentage' },
    { id: '3', name: 'GST 18%', rate: 18, type: 'percentage' },
    { id: '4', name: 'GST 28%', rate: 28, type: 'percentage' },
  ],
  allowPosOverride: false,
};

export function TaxSettings({ onBack }: TaxSettingsProps) {
  const { toast } = useToast();
  const { settings, setSettings, saveSettings, isLoading, isSaving } = useSettings<TaxSettingsData>(
    'taxSettings',
    defaultSettings
  );

  const [newSlab, setNewSlab] = useState({ name: '', rate: 0, type: 'percentage' as const });

  const handleSave = () => {
    saveSettings(settings);
  };

  const addTaxSlab = () => {
    if (!newSlab.name || newSlab.rate <= 0) {
      toast({
        title: 'Invalid Slab',
        description: 'Please enter a valid name and rate.',
        variant: 'destructive',
      });
      return;
    }

    const slab: TaxSlab = {
      id: Date.now().toString(),
      ...newSlab,
    };
    setSettings({ ...settings, taxSlabs: [...settings.taxSlabs, slab] });
    setNewSlab({ name: '', rate: 0, type: 'percentage' });
  };

  const removeTaxSlab = (id: string) => {
    setSettings({
      ...settings,
      taxSlabs: settings.taxSlabs.filter((s) => s.id !== id),
    });
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
          <h1 className="text-2xl font-bold">Tax Settings</h1>
          <p className="text-muted-foreground">Configure tax rates and GST</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Tax Settings */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-lg bg-warning/20 text-warning">
              <Receipt className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold">Tax Configuration</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium">Enable Tax</p>
                <p className="text-sm text-muted-foreground">Apply tax to products</p>
              </div>
              <Switch
                checked={settings.enableTax}
                onCheckedChange={(checked) => setSettings({ ...settings, enableTax: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium">Tax Inclusive Pricing</p>
                <p className="text-sm text-muted-foreground">Prices already include tax</p>
              </div>
              <Switch
                checked={settings.taxInclusive}
                onCheckedChange={(checked) => setSettings({ ...settings, taxInclusive: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>Default Tax Rate (%)</Label>
              <Input
                type="number"
                value={settings.defaultTaxRate}
                onChange={(e) => setSettings({ ...settings, defaultTaxRate: parseFloat(e.target.value) || 0 })}
                className="input-retail"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium">GST Mode</p>
                <p className="text-sm text-muted-foreground">Split into CGST & SGST</p>
              </div>
              <Switch
                checked={settings.gstEnabled}
                onCheckedChange={(checked) => setSettings({ ...settings, gstEnabled: checked })}
              />
            </div>

            {settings.gstEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CGST Rate (%)</Label>
                  <Input
                    type="number"
                    value={settings.cgstRate}
                    onChange={(e) => setSettings({ ...settings, cgstRate: parseFloat(e.target.value) || 0 })}
                    className="input-retail"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SGST Rate (%)</Label>
                  <Input
                    type="number"
                    value={settings.sgstRate}
                    onChange={(e) => setSettings({ ...settings, sgstRate: parseFloat(e.target.value) || 0 })}
                    className="input-retail"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
              <div>
                <p className="font-medium">Allow POS Tax Override</p>
                <p className="text-sm text-muted-foreground">Modify tax at checkout</p>
              </div>
              <Switch
                checked={settings.allowPosOverride}
                onCheckedChange={(checked) => setSettings({ ...settings, allowPosOverride: checked })}
              />
            </div>
          </div>
        </div>

        {/* Tax Slabs */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-lg bg-primary/20 text-primary">
              <Plus className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold">Tax Slabs</h2>
          </div>

          <div className="space-y-4 mb-4">
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="Slab name"
                value={newSlab.name}
                onChange={(e) => setNewSlab({ ...newSlab, name: e.target.value })}
                className="input-retail"
              />
              <Input
                type="number"
                placeholder="Rate"
                value={newSlab.rate || ''}
                onChange={(e) => setNewSlab({ ...newSlab, rate: parseFloat(e.target.value) || 0 })}
                className="input-retail"
              />
              <Button onClick={addTaxSlab} size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Add
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settings.taxSlabs.map((slab) => (
                  <TableRow key={slab.id} className="table-row-hover">
                    <TableCell>{slab.name}</TableCell>
                    <TableCell>{slab.rate}%</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTaxSlab(slab.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            Save Tax Settings
          </>
        )}
      </Button>
    </div>
  );
}
