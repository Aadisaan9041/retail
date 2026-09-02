import { useState } from 'react';
import { 
  Settings, 
  Monitor, 
  Store, 
  CreditCard, 
  Receipt, 
  Users,
  Shield,
  Truck,
  FileText,
  Package,
  Plug
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SettingsTile } from './settings/SettingsTile';
import { UserManagement } from './settings/UserManagement';
import { AppSettings } from './settings/AppSettings';
import { POSSettings } from './settings/POSSettings';
import { WebstoreSettings } from './settings/WebstoreSettings';
import { PaymentSettings } from './settings/PaymentSettings';
import { TaxSettings } from './settings/TaxSettings';
import { DropshippingSettings } from './settings/DropshippingSettings';
import { PriceOverrideAudit } from './PriceOverrideAudit';
import { DeliveryPartnerSettings } from './settings/DeliveryPartnerSettings';
import { IntegrationSettings } from './settings/IntegrationSettings';

type SettingsPage = 'tiles' | 'users' | 'app' | 'pos' | 'webstore' | 'payment' | 'integrations' | 'tax' | 'dropshipping' | 'audit' | 'delivery';

export function SettingsView() {
  const { isAdmin, roles } = useAuth();
  const [currentPage, setCurrentPage] = useState<SettingsPage>('tiles');

  const handleBack = () => setCurrentPage('tiles');

  // Render sub-pages
  if (currentPage === 'users') {
    return <UserManagement onBack={handleBack} />;
  }
  if (currentPage === 'app') {
    return <AppSettings onBack={handleBack} />;
  }
  if (currentPage === 'pos') {
    return <POSSettings onBack={handleBack} />;
  }
  if (currentPage === 'webstore') {
    return <WebstoreSettings onBack={handleBack} />;
  }
  if (currentPage === 'payment') {
    return <PaymentSettings onBack={handleBack} />;
  }
  if (currentPage === 'integrations') {
    return <IntegrationSettings onBack={handleBack} />;
  }
  if (currentPage === 'tax') {
    return <TaxSettings onBack={handleBack} />;
  }
  if (currentPage === 'dropshipping') {
    return (
      <div className="space-y-6 animate-slide-up">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold">Dropshipping Integration</h1>
        </div>
        <DropshippingSettings />
      </div>
    );
  }
  if (currentPage === 'audit') {
    return (
      <div className="space-y-6 animate-slide-up">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold">Price Override Audit</h1>
        </div>
        <PriceOverrideAudit />
      </div>
    );
  }
  if (currentPage === 'delivery') {
    return (
      <div className="space-y-6 animate-slide-up">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-secondary rounded-lg transition-colors"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold">Delivery Partners</h1>
        </div>
        <DeliveryPartnerSettings />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">
          System configuration and preferences
        </p>
      </div>

      {/* Role Info */}
      <div className="glass-card rounded-xl p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-lg bg-primary/20 text-primary">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold">Your Role</h2>
            <p className="text-sm text-muted-foreground">
              Access level: {roles.join(', ') || 'None'}
            </p>
          </div>
        </div>
      </div>

      {/* Settings Tiles */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SettingsTile
            title="User Management"
            description="Create and manage staff accounts"
            icon={Users}
            onClick={() => setCurrentPage('users')}
            color="accent"
          />
          <SettingsTile
            title="App Settings"
            description="App name, logo, and general config"
            icon={Settings}
            onClick={() => setCurrentPage('app')}
            color="primary"
          />
          <SettingsTile
            title="POS Settings"
            description="Configure point of sale behavior"
            icon={Monitor}
            onClick={() => setCurrentPage('pos')}
            color="success"
          />
          <SettingsTile
            title="Webstore Settings"
            description="Configure your online store"
            icon={Store}
            onClick={() => setCurrentPage('webstore')}
            color="warning"
          />
          <SettingsTile
            title="Payment Settings"
            description="Razorpay, PayU, and UPI config"
            icon={CreditCard}
            onClick={() => setCurrentPage('payment')}
            color="primary"
          />
          <SettingsTile
            title="Integrations & API"
            description="Securely connect Amazon, Flipkart, Meesho and payment APIs"
            icon={Plug}
            onClick={() => setCurrentPage('integrations')}
            color="success"
          />
          <SettingsTile
            title="Tax Settings"
            description="GST and tax slab configuration"
            icon={Receipt}
            onClick={() => setCurrentPage('tax')}
            color="accent"
          />
          <SettingsTile
            title="Dropshipping"
            description="Connect third-party product feeds"
            icon={Truck}
            onClick={() => setCurrentPage('dropshipping')}
            color="success"
          />
          <SettingsTile
            title="Price Override Audit"
            description="View price modification history"
            icon={FileText}
            onClick={() => setCurrentPage('audit')}
            color="warning"
          />
          <SettingsTile
            title="Delivery Partners"
            description="Manage webstore delivery agents"
            icon={Package}
            onClick={() => setCurrentPage('delivery')}
            color="primary"
          />
        </div>
      )}

      {/* Non-admin view */}
      {!isAdmin && (
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-lg bg-warning/20 text-warning">
              <Shield className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold">Access Restricted</h2>
          </div>
          <p className="text-muted-foreground">
            Settings management requires admin privileges. Contact your administrator for access.
          </p>
        </div>
      )}
    </div>
  );
}
