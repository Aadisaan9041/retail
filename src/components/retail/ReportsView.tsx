import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Package, DollarSign, Truck } from 'lucide-react';
import { Transaction, Product, DashboardMetrics } from '@/types/retail';
import { MetricCard } from './MetricCard';
import { useCurrency } from '@/hooks/useCurrency';
import { supabase } from '@/integrations/supabase/client';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ReportsViewProps {
  transactions: Transaction[];
  products: Product[];
  metrics: DashboardMetrics;
}

export function ReportsView({ transactions, products, metrics }: ReportsViewProps) {
  const { formatCurrency } = useCurrency();
  const [supplierChartData, setSupplierChartData] = useState<any[]>([]);
  const [supplierNames, setSupplierNames] = useState<string[]>([]);
  const [chartPeriod, setChartPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    const fetchSupplierSalesData = async () => {
      // Fetch suppliers
      const { data: suppliers } = await (supabase.from('suppliers' as any).select('id, name') as any);
      if (!suppliers?.length) return;

      // Fetch transaction items with dates
      const { data: txItems } = await supabase
        .from('transaction_items')
        .select('product_id, quantity, total_price, created_at')
        .order('created_at', { ascending: true });
      if (!txItems?.length) return;

      // Build product->supplier map
      const prodSupplierMap: Record<string, string> = {};
      products.forEach(p => {
        if (p.supplier_id) prodSupplierMap[p.id] = p.supplier_id;
      });

      const supplierNameMap: Record<string, string> = {};
      (suppliers as any[]).forEach((s: any) => { supplierNameMap[s.id] = s.name; });

      // Determine date range
      const now = new Date();
      const daysBack = chartPeriod === '7d' ? 7 : chartPeriod === '30d' ? 30 : 90;
      const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

      // Group by week/day and supplier
      const buckets: Record<string, Record<string, number>> = {};
      const activeSupplierIds = new Set<string>();

      txItems.forEach((item: any) => {
        const date = new Date(item.created_at);
        if (date < startDate) return;
        const supplierId = prodSupplierMap[item.product_id];
        if (!supplierId) return;

        activeSupplierIds.add(supplierId);
        // Group by week
        const weekStart = new Date(date);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const key = weekStart.toISOString().slice(0, 10);

        if (!buckets[key]) buckets[key] = {};
        buckets[key][supplierId] = (buckets[key][supplierId] || 0) + Number(item.total_price);
      });

      const names = Array.from(activeSupplierIds).map(id => supplierNameMap[id] || 'Unknown');
      setSupplierNames(names);

      const chartData = Object.entries(buckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([weekKey, supplierRevenues]) => {
          const row: any = { week: new Date(weekKey).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }) };
          Array.from(activeSupplierIds).forEach(id => {
            row[supplierNameMap[id] || 'Unknown'] = Math.round(supplierRevenues[id] || 0);
          });
          return row;
        });

      setSupplierChartData(chartData);
    };

    fetchSupplierSalesData();
  }, [products, chartPeriod]);

  // Calculate additional metrics
  const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.total), 0);
  
  const productCostMap = products.reduce((acc, p) => {
    acc[p.id] = Number(p.cost);
    return acc;
  }, {} as Record<string, number>);

  const totalCost = transactions.reduce((sum, t) => 
    sum + t.items.reduce((itemSum, item) => {
      const cost = productCostMap[item.product_id] || 0;
      return itemSum + cost * item.quantity;
    }, 0), 0
  );
  const grossProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const productMap = products.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<string, Product>);

  const categoryBreakdown = transactions.reduce((acc, t) => {
    t.items.forEach((item) => {
      const product = productMap[item.product_id];
      const category = product?.category || 'Uncategorized';
      if (!acc[category]) acc[category] = 0;
      acc[category] += Number(item.total_price);
    });
    return acc;
  }, {} as Record<string, number>);

  const topCategories = Object.entries(categoryBreakdown)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const productRevenue = transactions.reduce((acc, t) => {
    t.items.forEach((item) => {
      const product = productMap[item.product_id];
      if (!product) return;
      if (!acc[item.product_id]) {
        acc[item.product_id] = { product, revenue: 0, quantity: 0 };
      }
      acc[item.product_id].revenue += Number(item.total_price);
      acc[item.product_id].quantity += item.quantity;
    });
    return acc;
  }, {} as Record<string, { product: Product; revenue: number; quantity: number }>);

  const topProducts = Object.values(productRevenue)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const chartColors = [
    'hsl(var(--primary))',
    'hsl(var(--accent))',
    'hsl(142, 76%, 36%)',
    'hsl(38, 92%, 50%)',
    'hsl(280, 65%, 60%)',
    'hsl(0, 84%, 60%)',
  ];

  const chartConfig = supplierNames.reduce((acc, name, idx) => {
    acc[name] = { label: name, color: chartColors[idx % chartColors.length] };
    return acc;
  }, {} as Record<string, { label: string; color: string }>);

  return (
    <div className="space-y-6 sm:space-y-8 animate-slide-up">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Reports</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">Sales analytics and performance metrics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <MetricCard title="Total Revenue" value={formatCurrency(totalRevenue)} subtitle={`${transactions.length} transactions`} icon={DollarSign} variant="success" />
        <MetricCard title="Gross Profit" value={formatCurrency(grossProfit)} subtitle={`${profitMargin.toFixed(1)}% margin`} icon={TrendingUp} variant="success" />
        <MetricCard title="Avg Order Value" value={formatCurrency(metrics.averageOrderValue)} subtitle="Per transaction" icon={BarChart3} variant="default" />
        <MetricCard title="Products Sold" value={transactions.reduce((sum, t) => sum + t.items.reduce((is, i) => is + i.quantity, 0), 0)} subtitle="Total units" icon={Package} variant="default" />
      </div>

      {/* Supplier-wise Sales Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            <CardTitle className="text-base sm:text-lg">Supplier Revenue Trends</CardTitle>
          </div>
          <Select value={chartPeriod} onValueChange={(v) => setChartPeriod(v as any)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {supplierChartData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Truck className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No supplier sales data available yet. Link products to suppliers and make sales to see trends.</p>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={supplierChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="week" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                {supplierNames.map((name, idx) => (
                  <Bar key={name} dataKey={name} fill={chartColors[idx % chartColors.length]} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Sales by Category */}
        <div className="glass-card rounded-xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-base sm:text-lg font-semibold">Sales by Category</h2>
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          </div>
          {topCategories.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-muted-foreground">
              <p className="text-sm sm:text-base">No sales data yet</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {topCategories.map(([category, revenue]) => {
                const percentage = (revenue / totalRevenue) * 100;
                return (
                  <div key={category}>
                    <div className="flex justify-between text-xs sm:text-sm mb-1">
                      <span className="font-medium truncate mr-2">{category}</span>
                      <span className="text-muted-foreground flex-shrink-0">{formatCurrency(revenue)}</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top Products */}
        <div className="glass-card rounded-xl p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-base sm:text-lg font-semibold">Top Products</h2>
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          </div>
          {topProducts.length === 0 ? (
            <div className="text-center py-6 sm:py-8 text-muted-foreground">
              <p className="text-sm sm:text-base">No sales data yet</p>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {topProducts.map(({ product, revenue, quantity }, index) => (
                <div key={product.id} className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/20 text-primary text-xs sm:text-sm font-bold flex items-center justify-center flex-shrink-0">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-xs sm:text-sm truncate">{product.name}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{quantity} units sold</p>
                    </div>
                  </div>
                  <p className="font-semibold text-success text-xs sm:text-sm flex-shrink-0 ml-2">{formatCurrency(revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
