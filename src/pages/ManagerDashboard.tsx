import { useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/retail/Sidebar';
import { MobileSidebar } from '@/components/retail/MobileSidebar';
import { Dashboard } from '@/components/retail/Dashboard';
import { POSView } from '@/components/retail/POSView';
import { TransactionsView } from '@/components/retail/TransactionsView';
import { CustomersView } from '@/components/retail/CustomersView';
import { VoiceAssistant } from '@/components/retail/VoiceAssistant';
import { VoiceAssistantButton } from '@/components/retail/VoiceAssistantButton';
import { useRetailStore } from '@/hooks/useRetailStore';
import { useAuth } from '@/contexts/AuthContext';
import { ViewType } from '@/types/retail';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';

type ManagerViewType = 'dashboard' | 'pos' | 'transactions' | 'customers';

const ManagerDashboard = () => {
  const [currentView, setCurrentView] = useState<ManagerViewType>('pos');
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);
  const { user, isLoading: authLoading, isManager, isAdmin, profile, roles, signOut } = useAuth();
  const { toast } = useToast();
  
  const store = useRetailStore();

  const handleVoiceAction = useCallback(async (action: string, params: Record<string, unknown>): Promise<unknown> => {
    console.log('Voice action:', action, params);
    
    switch (action) {
      case 'add_to_cart':
        const productName = (params.product_name as string || '').toLowerCase();
        const qty = (params.quantity as number) || 1;
        const product = store.products.find(p => 
          p.name.toLowerCase().includes(productName)
        );
        
        if (product) {
          for (let i = 0; i < qty; i++) {
            store.addToCart(product);
          }
          setCurrentView('pos');
          toast({
            title: 'Added to Cart',
            description: `${qty}x ${product.name} added to cart`
          });
          return { success: true, message: `Added ${qty}x ${product.name} to cart` };
        }
        return { success: false, message: 'Product not found' };
      
      case 'checkout':
        if (store.cart.length === 0) {
          return { success: false, message: 'Cart is empty' };
        }
        const paymentMethod = (params.payment_method as 'cash' | 'card') || 'cash';
        const transaction = await store.processTransaction(paymentMethod);
        if (transaction) {
          toast({
            title: 'Transaction Complete',
            description: `Payment of $${transaction.total.toFixed(2)} processed via ${paymentMethod}`
          });
          return { success: true, message: `Processed ${paymentMethod} payment` };
        }
        return { success: false, message: 'Transaction failed' };
      
      default:
        return { error: 'Unknown action' };
    }
  }, [store, toast]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Redirect admin to admin dashboard
  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  // Check if user has manager role
  if (!isManager && !authLoading) {
    return <Navigate to="/auth" replace />;
  }

  const metrics = store.getMetrics();
  const cartTotal = store.calculateCartTotal();

  const managerNavItems = [
    { id: 'dashboard' as const, label: 'Dashboard' },
    { id: 'pos' as const, label: 'POS' },
    { id: 'transactions' as const, label: 'Transactions' },
    { id: 'customers' as const, label: 'Customers' },
  ];

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard metrics={metrics} transactions={store.transactions} products={store.products} onRefresh={store.refreshData} />;
      case 'pos':
        return (
          <POSView
            products={store.products}
            cart={store.cart}
            customers={store.customers}
            selectedCustomer={store.selectedCustomer}
            onAddToCart={store.addToCart}
            onRemoveFromCart={store.removeFromCart}
            onUpdateQuantity={store.updateCartQuantity}
            onUpdateItemPrice={store.updateCartItemPrice}
            onClearCart={store.clearCart}
            onProcessTransaction={store.processTransaction}
            onSelectCustomer={store.setSelectedCustomer}
            onAddCustomer={store.addCustomer}
            onFindByBarcode={store.findProductByBarcode}
            cartTotal={cartTotal}
          />
        );
      case 'transactions':
        return <TransactionsView transactions={store.transactions} />;
      case 'customers':
        return (
          <CustomersView
            customers={store.customers}
            onAddCustomer={store.addCustomer}
            onUpdateCustomer={store.updateCustomer}
          />
        );
      default:
        return <Dashboard metrics={metrics} transactions={store.transactions} products={store.products} onRefresh={store.refreshData} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar 
          currentView={currentView as ViewType} 
          onViewChange={(view) => {
            if (managerNavItems.some(item => item.id === view)) {
              setCurrentView(view as ManagerViewType);
            }
          }}
          profile={profile}
          roles={roles}
          onSignOut={signOut}
        />
      </div>
      
      {/* Mobile Sidebar */}
      <MobileSidebar
        currentView={currentView as ViewType}
        onViewChange={(view) => {
          if (managerNavItems.some(item => item.id === view)) {
            setCurrentView(view as ManagerViewType);
          }
        }}
        profile={profile}
        roles={roles}
        onSignOut={signOut}
      />
      
      <main className="lg:ml-64 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
        {store.isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          renderView()
        )}
      </main>
      
      {/* Voice Assistant Button */}
      <VoiceAssistantButton 
        onClick={() => setIsVoiceAssistantOpen(true)}
        isActive={isVoiceAssistantOpen}
      />
      
      {/* Voice Assistant Modal */}
      <VoiceAssistant
        isOpen={isVoiceAssistantOpen}
        onClose={() => setIsVoiceAssistantOpen(false)}
        onNavigate={(view) => {
          if (managerNavItems.some(item => item.id === view)) {
            setCurrentView(view as ManagerViewType);
          }
        }}
        onAction={handleVoiceAction}
      />
      
      <Toaster />
    </div>
  );
};

export default ManagerDashboard;