import { useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/retail/Sidebar';
import { AdminBottomNav } from '@/components/retail/AdminBottomNav';
import { Dashboard } from '@/components/retail/Dashboard';
import { POSView } from '@/components/retail/POSView';
import { ProductsView } from '@/components/retail/ProductsView';
import { TransactionsView } from '@/components/retail/TransactionsView';
import { ReportsView } from '@/components/retail/ReportsView';
import { CustomersView } from '@/components/retail/CustomersView';
import { ReordersView } from '@/components/retail/ReordersView';
import { SettingsView } from '@/components/retail/SettingsView';
import { LoyaltyManagement } from '@/components/retail/LoyaltyManagement';
import { LoyaltyAnalytics } from '@/components/retail/LoyaltyAnalytics';
import { OrderManagement } from '@/components/retail/OrderManagement';
import { VoiceAssistant } from '@/components/retail/VoiceAssistant';
import { VoiceAssistantButton } from '@/components/retail/VoiceAssistantButton';
import { AIInventoryRecommendations } from '@/components/retail/AIInventoryRecommendations';
import { SuppliersView } from '@/components/retail/SuppliersView';
import { useRetailStore } from '@/hooks/useRetailStore';
import { useAuth } from '@/contexts/AuthContext';
import { ViewType } from '@/types/retail';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import { useUPINotifications } from '@/hooks/useUPINotifications';
import { useCurrency } from '@/hooks/useCurrency';

const Admin = () => {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [isVoiceAssistantOpen, setIsVoiceAssistantOpen] = useState(false);
  const { user, isLoading: authLoading, isStaff, profile, roles, signOut } = useAuth();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  useUPINotifications(!!user);
  
  const store = useRetailStore();

  // Voice assistant action handler
  const handleVoiceAction = useCallback(async (action: string, params: Record<string, unknown>): Promise<unknown> => {
    console.log('Voice action:', action, params);
    
    switch (action) {
      case 'get_metrics':
        const metrics = store.getMetrics();
        return {
          todaySales: formatCurrency(metrics.todaySales),
          todayTransactions: metrics.todayTransactions,
          averageOrderValue: formatCurrency(metrics.averageOrderValue),
          lowStockItems: metrics.lowStockItems,
          totalProducts: metrics.totalProducts,
          pendingReorders: metrics.pendingReorders
        };
      
      case 'search_products':
        const query = (params.query as string || '').toLowerCase();
        const category = (params.category as string || '').toLowerCase();
        const filtered = store.products.filter(p => {
          const matchesQuery = !query || p.name.toLowerCase().includes(query);
          const matchesCategory = !category || p.category?.toLowerCase().includes(category);
          return matchesQuery && matchesCategory;
        });
        return filtered.slice(0, 5).map(p => ({
          name: p.name,
          price: formatCurrency(Number(p.price)),
          quantity: p.quantity,
          category: p.category
        }));
      
      case 'get_low_stock':
        const lowStock = store.products.filter(p => p.quantity <= p.low_stock_threshold);
        return lowStock.map(p => ({
          name: p.name,
          currentStock: p.quantity,
          threshold: p.low_stock_threshold
        }));
      
      case 'search_customers':
        const customerQuery = (params.query as string || '').toLowerCase();
        const matchedCustomers = store.customers.filter(c => 
          c.name.toLowerCase().includes(customerQuery) ||
          c.email?.toLowerCase().includes(customerQuery) ||
          c.phone?.includes(customerQuery)
        );
        return matchedCustomers.slice(0, 5).map(c => ({
          name: c.name,
          email: c.email,
          phone: c.phone,
          loyaltyPoints: c.loyalty_points,
          totalSpent: formatCurrency(Number(c.total_spent))
        }));
      
      case 'get_transactions':
        const limit = (params.limit as number) || 5;
        return store.transactions.slice(0, limit).map(t => ({
          id: t.id.slice(0, 8),
          total: formatCurrency(t.total),
          items: t.items.length,
          paymentMethod: t.payment_method,
          date: new Date(t.created_at).toLocaleDateString()
        }));
      
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
      
      case 'clear_cart':
        store.clearCart();
        toast({
          title: 'Cart Cleared',
          description: 'All items removed from cart'
        });
        return { success: true, message: 'Cart cleared' };
      
      case 'checkout':
        if (store.cart.length === 0) {
          return { success: false, message: 'Cart is empty' };
        }
        const paymentMethod = (params.payment_method as 'cash' | 'card') || 'cash';
        const transaction = await store.processTransaction(paymentMethod);
        if (transaction) {
          toast({
            title: 'Transaction Complete',
            description: `Payment of ${formatCurrency(transaction.total)} processed via ${paymentMethod}`
          });
          return { success: true, message: `Processed ${paymentMethod} payment` };
        }
        return { success: false, message: 'Transaction failed' };
      
      case 'get_report':
        const period = (params.period as string) || 'today';
        const now = new Date();
        let startDate = new Date();
        
        if (period === 'week') {
          startDate.setDate(now.getDate() - 7);
        } else if (period === 'month') {
          startDate.setMonth(now.getMonth() - 1);
        } else {
          startDate.setHours(0, 0, 0, 0);
        }
        
        const periodTransactions = store.transactions.filter(t => 
          new Date(t.created_at) >= startDate
        );
        const totalSales = periodTransactions.reduce((sum, t) => sum + t.total, 0);
        
        return {
          period,
          totalSales: formatCurrency(totalSales),
          transactionCount: periodTransactions.length,
          averageOrder: periodTransactions.length > 0 
            ? formatCurrency(totalSales / periodTransactions.length)
            : formatCurrency(0)
        };
      
      case 'update_price':
        const priceProductName = (params.product_name as string || '').toLowerCase();
        const newPrice = params.new_price as number;
        const priceProduct = store.products.find(p => p.name.toLowerCase().includes(priceProductName));
        if (priceProduct && newPrice > 0) {
          await store.updateProduct(priceProduct.id, { price: newPrice });
          toast({ title: 'Price Updated', description: `${priceProduct.name} now costs ${formatCurrency(newPrice)}` });
          return { success: true, message: `Updated ${priceProduct.name} price to ${formatCurrency(newPrice)}` };
        }
        return { success: false, message: 'Product not found or invalid price' };
      
      case 'create_reorder':
        const reorderProductName = (params.product_name as string || '').toLowerCase();
        const reorderProduct = store.products.find(p => p.name.toLowerCase().includes(reorderProductName));
        if (reorderProduct) {
          const qty = (params.quantity as number) || reorderProduct.reorder_quantity || 50;
          toast({ title: 'Reorder Created', description: `Reorder request for ${qty} units of ${reorderProduct.name}` });
          return { success: true, message: `Created reorder for ${qty} units of ${reorderProduct.name}` };
        }
        return { success: false, message: 'Product not found' };
      
      case 'update_stock':
        const stockProductName = (params.product_name as string || '').toLowerCase();
        const newQuantity = params.quantity as number;
        const stockProduct = store.products.find(p => p.name.toLowerCase().includes(stockProductName));
        if (stockProduct && newQuantity >= 0) {
          await store.updateProduct(stockProduct.id, { quantity: newQuantity });
          toast({ title: 'Stock Updated', description: `${stockProduct.name} now has ${newQuantity} units` });
          return { success: true, message: `Updated ${stockProduct.name} stock to ${newQuantity}` };
        }
        return { success: false, message: 'Product not found or invalid quantity' };
      
      default:
        return { error: 'Unknown action' };
    }
  }, [store, toast, formatCurrency]);

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

  // Check if user has staff role
  if (!isStaff && !authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md p-6 sm:p-8 glass-card rounded-2xl w-full">
          <h2 className="text-xl sm:text-2xl font-bold mb-4">Access Pending</h2>
          <p className="text-muted-foreground mb-6 text-sm sm:text-base">
            Your account has been created but you haven't been assigned a role yet. 
            Please contact an administrator to get access to the POS system.
          </p>
          <button
            onClick={() => signOut()}
            className="text-primary hover:underline"
          >
            Sign out and try again
          </button>
        </div>
      </div>
    );
  }

  const metrics = store.getMetrics();
  const cartTotal = store.calculateCartTotal();

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
      case 'products':
        return (
          <ProductsView
            products={store.products}
            categories={store.categories}
            onAddProduct={store.addProduct}
            onUpdateProduct={store.updateProduct}
            onDeleteProduct={store.deleteProduct}
            onAddCategory={store.addCategory}
          />
        );
      case 'transactions':
        return <TransactionsView transactions={store.transactions} />;
      case 'reports':
        return <ReportsView transactions={store.transactions} products={store.products} metrics={metrics} />;
      case 'customers':
        return (
          <CustomersView
            customers={store.customers}
            onAddCustomer={store.addCustomer}
            onUpdateCustomer={store.updateCustomer}
          />
        );
      case 'reorders':
        return (
          <ReordersView
            reorderRequests={store.reorderRequests}
            onFulfillReorder={store.fulfillReorder}
          />
        );
      case 'loyalty':
        return (
          <LoyaltyManagement
            customers={store.customers}
            onRefresh={store.refreshData}
          />
        );
      case 'loyalty-analytics':
        return <LoyaltyAnalytics />;
      case 'orders':
        return <OrderManagement />;
      case 'ai-recommendations':
        return <AIInventoryRecommendations />;
      case 'suppliers':
        return <SuppliersView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <Dashboard metrics={metrics} transactions={store.transactions} products={store.products} onRefresh={store.refreshData} />;
    }
  };

  const cartItemCount = store.cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar 
          currentView={currentView} 
          onViewChange={setCurrentView}
          profile={profile}
          roles={roles}
          onSignOut={signOut}
        />
      </div>
      
      {/* Mobile Bottom Navigation */}
      <AdminBottomNav
        currentView={currentView}
        onViewChange={setCurrentView}
        cartItemCount={cartItemCount}
      />
      
      <main className="lg:ml-64 p-4 sm:p-6 lg:p-8">
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
        onNavigate={setCurrentView}
        onAction={handleVoiceAction}
      />
      
      <Toaster />
    </div>
  );
};

export default Admin;
