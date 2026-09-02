import { useState, useEffect } from 'react';
import { Bell, BellOff, AlertTriangle, Package, RefreshCw, Mail, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Product } from '@/types/retail';
import { useNotifications } from '@/hooks/useNotifications';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface InventoryAlertsProps {
  products: Product[];
  onRefresh?: () => void;
}

export function InventoryAlerts({ products, onRefresh }: InventoryAlertsProps) {
  const [alertsEnabled, setAlertsEnabled] = useState(() => {
    return localStorage.getItem('inventoryAlertsEnabled') === 'true';
  });
  const [emailAlerts, setEmailAlerts] = useState(() => {
    return localStorage.getItem('emailAlertsEnabled') === 'true';
  });
  const [alertEmail, setAlertEmail] = useState(() => {
    return localStorage.getItem('alertEmail') || '';
  });
  const [whatsappAlerts, setWhatsappAlerts] = useState(() => {
    return localStorage.getItem('whatsappAlertsEnabled') === 'true';
  });
  const [alertPhone, setAlertPhone] = useState(() => {
    return localStorage.getItem('alertPhone') || '';
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  const { 
    isSupported, 
    permission, 
    requestPermission,
    showLowStockAlert,
    showOutOfStockAlert,
  } = useNotifications();
  const { toast } = useToast();

  const lowStockProducts = products.filter(p => p.quantity <= p.low_stock_threshold && p.quantity > 0);
  const outOfStockProducts = products.filter(p => p.quantity === 0);
  const criticalProducts = products.filter(p => p.quantity <= p.low_stock_threshold / 2 && p.quantity > 0);

  // Check for stock alerts
  useEffect(() => {
    if (!alertsEnabled || permission !== 'granted') return;

    // Check for critical stock levels
    criticalProducts.forEach(product => {
      showLowStockAlert(product.name, product.quantity);
    });

    // Check for out of stock
    outOfStockProducts.forEach(product => {
      showOutOfStockAlert(product.name);
    });
  }, [alertsEnabled, permission, criticalProducts, outOfStockProducts, showLowStockAlert, showOutOfStockAlert]);

  const handleEnableAlerts = async () => {
    const granted = await requestPermission();
    if (granted) {
      setAlertsEnabled(true);
      localStorage.setItem('inventoryAlertsEnabled', 'true');
    }
  };

  const handleDisableAlerts = () => {
    setAlertsEnabled(false);
    localStorage.setItem('inventoryAlertsEnabled', 'false');
  };

  const saveSettings = () => {
    localStorage.setItem('emailAlertsEnabled', emailAlerts.toString());
    localStorage.setItem('alertEmail', alertEmail);
    localStorage.setItem('whatsappAlertsEnabled', whatsappAlerts.toString());
    localStorage.setItem('alertPhone', alertPhone);
    setSettingsOpen(false);
    toast({
      title: 'Settings Saved',
      description: 'Alert settings have been updated',
    });
  };

  const sendAlertNow = async () => {
    if (lowStockProducts.length === 0 && outOfStockProducts.length === 0) {
      toast({
        title: 'No Alerts',
        description: 'All products are well stocked',
      });
      return;
    }

    setIsSending(true);

    try {
      // Send email alert
      if (emailAlerts && alertEmail) {
        const alertItems = [
          ...outOfStockProducts.map(p => ({ name: p.name, status: 'Out of Stock', quantity: 0 })),
          ...lowStockProducts.map(p => ({ name: p.name, status: 'Low Stock', quantity: p.quantity })),
        ];

        await supabase.functions.invoke('send-inventory-alert', {
          body: {
            email: alertEmail,
            items: alertItems,
            type: 'inventory',
          },
        });
      }

      // Send WhatsApp alert
      if (whatsappAlerts && alertPhone) {
        const message = encodeURIComponent(
          `🚨 Inventory Alert\n\n` +
          `Out of Stock: ${outOfStockProducts.length}\n` +
          `Low Stock: ${lowStockProducts.length}\n\n` +
          outOfStockProducts.slice(0, 5).map(p => `❌ ${p.name}`).join('\n') +
          (outOfStockProducts.length > 5 ? `\n...and ${outOfStockProducts.length - 5} more` : '') +
          '\n\n' +
          lowStockProducts.slice(0, 5).map(p => `⚠️ ${p.name} (${p.quantity} left)`).join('\n') +
          (lowStockProducts.length > 5 ? `\n...and ${lowStockProducts.length - 5} more` : '')
        );
        const phoneNumber = alertPhone.replace(/\D/g, '');
        window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
      }

      toast({
        title: 'Alerts Sent',
        description: 'Inventory alerts have been sent successfully',
      });
    } catch (error) {
      console.error('Error sending alerts:', error);
      toast({
        title: 'Error',
        description: 'Failed to send alerts',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="glass-card rounded-xl p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            outOfStockProducts.length > 0 ? 'bg-destructive/20 text-destructive' :
            lowStockProducts.length > 0 ? 'bg-warning/20 text-warning' :
            'bg-success/20 text-success'
          )}>
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-semibold">Inventory Alerts</h2>
            <p className="text-xs text-muted-foreground">
              {outOfStockProducts.length + lowStockProducts.length} items need attention
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isSupported && (
            <Button
              variant={alertsEnabled ? 'default' : 'outline'}
              size="sm"
              onClick={alertsEnabled ? handleDisableAlerts : handleEnableAlerts}
              className="hidden sm:flex"
            >
              {alertsEnabled ? (
                <>
                  <Bell className="w-4 h-4 mr-2" />
                  On
                </>
              ) : (
                <>
                  <BellOff className="w-4 h-4 mr-2" />
                  Off
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
          >
            <Mail className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </div>
      </div>

      {/* Alert Summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="text-center p-2 sm:p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-lg sm:text-2xl font-bold text-destructive">{outOfStockProducts.length}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Out of Stock</p>
        </div>
        <div className="text-center p-2 sm:p-3 rounded-lg bg-warning/10 border border-warning/20">
          <p className="text-lg sm:text-2xl font-bold text-warning">{lowStockProducts.length}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Low Stock</p>
        </div>
        <div className="text-center p-2 sm:p-3 rounded-lg bg-success/10 border border-success/20">
          <p className="text-lg sm:text-2xl font-bold text-success">
            {products.length - outOfStockProducts.length - lowStockProducts.length}
          </p>
          <p className="text-[10px] sm:text-xs text-muted-foreground">Well Stocked</p>
        </div>
      </div>

      {/* Alert List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {outOfStockProducts.length === 0 && lowStockProducts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">All products are well stocked</p>
          </div>
        ) : (
          <>
            {outOfStockProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-destructive/5 border border-destructive/20"
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <Package className="w-4 h-4 text-destructive flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-xs sm:text-sm truncate">{product.name}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{product.sku}</p>
                  </div>
                </div>
                <Badge variant="destructive" className="text-[10px] sm:text-xs flex-shrink-0">Out of Stock</Badge>
              </div>
            ))}
            {lowStockProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-warning/5 border border-warning/20"
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <Package className="w-4 h-4 text-warning flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-xs sm:text-sm truncate">{product.name}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{product.sku}</p>
                  </div>
                </div>
                <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px] sm:text-xs flex-shrink-0">
                  {product.quantity} left
                </Badge>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mt-4">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onRefresh}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={sendAlertNow}
          disabled={isSending || (lowStockProducts.length === 0 && outOfStockProducts.length === 0)}
        >
          <Mail className="w-4 h-4 mr-2" />
          {isSending ? 'Sending...' : 'Send Alert'}
        </Button>
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Alert Settings</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Push Notifications */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Push Notifications</Label>
                <p className="text-xs text-muted-foreground">Browser notifications for stock alerts</p>
              </div>
              <Switch
                checked={alertsEnabled}
                onCheckedChange={(checked) => {
                  if (checked) {
                    handleEnableAlerts();
                  } else {
                    handleDisableAlerts();
                  }
                }}
              />
            </div>

            {/* Email Alerts */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Email Alerts</Label>
                  <p className="text-xs text-muted-foreground">Receive stock alerts via email</p>
                </div>
                <Switch
                  checked={emailAlerts}
                  onCheckedChange={setEmailAlerts}
                />
              </div>
              {emailAlerts && (
                <Input
                  type="email"
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="h-9"
                />
              )}
            </div>

            {/* WhatsApp Alerts */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">WhatsApp Alerts</Label>
                  <p className="text-xs text-muted-foreground">Receive stock alerts via WhatsApp</p>
                </div>
                <Switch
                  checked={whatsappAlerts}
                  onCheckedChange={setWhatsappAlerts}
                />
              </div>
              {whatsappAlerts && (
                <Input
                  type="tel"
                  value={alertPhone}
                  onChange={(e) => setAlertPhone(e.target.value)}
                  placeholder="+91 9999999999"
                  className="h-9"
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveSettings}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
