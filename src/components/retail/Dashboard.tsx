import { DollarSign, ShoppingBag, TrendingUp, AlertTriangle, Package, Warehouse } from 'lucide-react';
import { MetricCard } from './MetricCard';
import { RecentTransactions } from './RecentTransactions';
import { InventoryAlerts } from './InventoryAlerts';
import { DashboardMetrics, Product, Transaction } from '@/types/retail';
import { useCurrency } from '@/hooks/useCurrency';

interface DashboardProps {
  metrics: DashboardMetrics;
  transactions: Transaction[];
  products: Product[];
  onRefresh?: () => void;
}

export function Dashboard({ metrics, transactions, products, onRefresh }: DashboardProps) {
  const { formatCurrency } = useCurrency();

  return (
    <div className="space-y-6 lg:space-y-8 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">Welcome back! Here's your store overview.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        <MetricCard
          title="Today's Sales"
          value={formatCurrency(metrics.todaySales)}
          subtitle={`${metrics.todayTransactions} transactions`}
          icon={DollarSign}
          variant="success"
          trend={{ value: 12.5, isPositive: true }}
        />
        <MetricCard
          title="Avg Order Value"
          value={formatCurrency(metrics.averageOrderValue)}
          subtitle="Per transaction"
          icon={TrendingUp}
          variant="default"
        />
        <MetricCard
          title="Low Stock"
          value={metrics.lowStockItems}
          subtitle="Need restocking"
          icon={AlertTriangle}
          variant={metrics.lowStockItems > 0 ? 'warning' : 'success'}
        />
        <MetricCard
          title="Products"
          value={metrics.totalProducts}
          subtitle="In catalog"
          icon={Package}
          variant="default"
        />
        <MetricCard
          title="Inventory"
          value={formatCurrency(metrics.totalInventoryValue)}
          subtitle="At cost"
          icon={Warehouse}
          variant="default"
        />
        <MetricCard
          title="Orders"
          value={metrics.todayTransactions}
          subtitle="Processed today"
          icon={ShoppingBag}
          variant="success"
        />
      </div>

      {/* Lower Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        <RecentTransactions transactions={transactions.slice(0, 5)} />
        <InventoryAlerts products={products} onRefresh={onRefresh} />
      </div>
    </div>
  );
}
