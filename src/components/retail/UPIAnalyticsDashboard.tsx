import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, CheckCircle, Clock, XCircle, IndianRupee, CalendarIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/hooks/useCurrency';
import { format, subDays, subMonths, startOfDay, parseISO, isAfter, isBefore, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface UPIVerification {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  verified_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  verified: '#10b981',
  pending: '#f59e0b',
  rejected: '#ef4444',
};

type DatePreset = '7d' | '14d' | '30d' | '90d' | 'custom';

export function UPIAnalyticsDashboard() {
  const [allVerifications, setAllVerifications] = useState<UPIVerification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<DatePreset>('14d');
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('upi_payment_verifications')
        .select('id, amount, status, created_at, verified_at')
        .order('created_at', { ascending: true });

      setAllVerifications(data || []);
      setIsLoading(false);
    };
    fetchData();
  }, []);

  // Compute date range
  const { fromDate, toDate, dayCount } = useMemo(() => {
    const now = new Date();
    let from: Date;
    let to: Date = endOfDay(now);

    switch (datePreset) {
      case '7d': from = startOfDay(subDays(now, 6)); break;
      case '14d': from = startOfDay(subDays(now, 13)); break;
      case '30d': from = startOfDay(subDays(now, 29)); break;
      case '90d': from = startOfDay(subDays(now, 89)); break;
      case 'custom':
        from = customFrom ? startOfDay(customFrom) : startOfDay(subDays(now, 13));
        to = customTo ? endOfDay(customTo) : endOfDay(now);
        break;
      default: from = startOfDay(subDays(now, 13)); break;
    }

    const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)));
    return { fromDate: from, toDate: to, dayCount: days };
  }, [datePreset, customFrom, customTo]);

  // Filter verifications by date range
  const verifications = useMemo(() => {
    return allVerifications.filter((v) => {
      const d = parseISO(v.created_at);
      return !isBefore(d, fromDate) && !isAfter(d, toDate);
    });
  }, [allVerifications, fromDate, toDate]);

  // Summary stats
  const totalPayments = verifications.length;
  const verifiedPayments = verifications.filter((v) => v.status === 'verified');
  const pendingPayments = verifications.filter((v) => v.status === 'pending');
  const rejectedPayments = verifications.filter((v) => v.status === 'rejected');
  const totalVerifiedAmount = verifiedPayments.reduce((sum, v) => sum + v.amount, 0);
  const totalPendingAmount = pendingPayments.reduce((sum, v) => sum + v.amount, 0);

  // Pie chart data
  const pieData = [
    { name: 'Verified', value: verifiedPayments.length, color: STATUS_COLORS.verified },
    { name: 'Pending', value: pendingPayments.length, color: STATUS_COLORS.pending },
    { name: 'Rejected', value: rejectedPayments.length, color: STATUS_COLORS.rejected },
  ].filter((d) => d.value > 0);

  // Daily chart data
  const dailyData = useMemo(() => {
    return Array.from({ length: dayCount }, (_, i) => {
      const date = startOfDay(new Date(fromDate.getTime() + i * 24 * 60 * 60 * 1000));
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayVer = verifications.filter(
        (v) => format(parseISO(v.created_at), 'yyyy-MM-dd') === dateStr
      );
      return {
        date: format(date, dayCount > 31 ? 'dd/MM' : 'dd MMM'),
        verified: dayVer.filter((v) => v.status === 'verified').length,
        pending: dayVer.filter((v) => v.status === 'pending').length,
        rejected: dayVer.filter((v) => v.status === 'rejected').length,
        total: dayVer.reduce((sum, v) => sum + v.amount, 0),
      };
    });
  }, [verifications, fromDate, dayCount]);

  const amountTrend = dailyData.map((d) => ({ date: d.date, amount: d.total }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const presetLabel: Record<DatePreset, string> = {
    '7d': 'Last 7 Days',
    '14d': 'Last 14 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
    'custom': 'Custom Range',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            UPI Payment Analytics
          </h3>
          <p className="text-sm text-muted-foreground">
            {format(fromDate, 'dd MMM yyyy')} — {format(toDate, 'dd MMM yyyy')}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={datePreset} onValueChange={(v) => setDatePreset(v as DatePreset)}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="14d">Last 14 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {datePreset === 'custom' && (
            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9 text-xs", !customFrom && "text-muted-foreground")}>
                    <CalendarIcon className="w-3 h-3 mr-1" />
                    {customFrom ? format(customFrom, 'dd MMM') : 'From'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customFrom}
                    onSelect={setCustomFrom}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9 text-xs", !customTo && "text-muted-foreground")}>
                    <CalendarIcon className="w-3 h-3 mr-1" />
                    {customTo ? format(customTo, 'dd MMM') : 'To'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={customTo}
                    onSelect={setCustomTo}
                    disabled={(date) => date > new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <IndianRupee className="w-4 h-4 text-primary" />
              <p className="text-xs text-muted-foreground">Total Verified</p>
            </div>
            <p className="text-xl font-bold text-success">{formatCurrency(totalVerifiedAmount)}</p>
            <p className="text-xs text-muted-foreground">{verifiedPayments.length} payments</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-warning" />
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <p className="text-xl font-bold text-warning">{formatCurrency(totalPendingAmount)}</p>
            <p className="text-xs text-muted-foreground">{pendingPayments.length} payments</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="w-4 h-4 text-success" />
              <p className="text-xs text-muted-foreground">Verification Rate</p>
            </div>
            <p className="text-xl font-bold">
              {totalPayments > 0 ? ((verifiedPayments.length / totalPayments) * 100).toFixed(0) : 0}%
            </p>
            <p className="text-xs text-muted-foreground">of all payments</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-destructive" />
              <p className="text-xs text-muted-foreground">Rejected</p>
            </div>
            <p className="text-xl font-bold text-destructive">{rejectedPayments.length}</p>
            <p className="text-xs text-muted-foreground">
              {totalPayments > 0 ? ((rejectedPayments.length / totalPayments) * 100).toFixed(0) : 0}% rejection rate
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Status Distribution Pie */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Payment Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground text-sm">
                No payment data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Daily Volume Bar Chart */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Daily Payments ({presetLabel[datePreset]})</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={dayCount > 30 ? Math.floor(dayCount / 10) : 0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--foreground))',
                  }}
                />
                <Bar dataKey="verified" stackId="a" fill={STATUS_COLORS.verified} name="Verified" />
                <Bar dataKey="pending" stackId="a" fill={STATUS_COLORS.pending} name="Pending" />
                <Bar dataKey="rejected" stackId="a" fill={STATUS_COLORS.rejected} name="Rejected" radius={[4, 4, 0, 0]} />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Amount Trend */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Payment Volume Trend ({presetLabel[datePreset]})</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={amountTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" interval={dayCount > 30 ? Math.floor(dayCount / 10) : 0} />
              <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                }}
                formatter={(value: number) => [formatCurrency(value), 'Amount']}
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
