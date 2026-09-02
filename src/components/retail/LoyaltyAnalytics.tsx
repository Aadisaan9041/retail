import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Users, TrendingUp, Award, Gift, Star } from 'lucide-react';
import { useCurrency } from '@/hooks/useCurrency';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line } from 'recharts';

interface LoyaltyTier {
  id: string;
  name: string;
  min_points: number;
  discount_percentage: number;
  color: string | null;
}

interface Customer {
  id: string;
  name: string;
  loyalty_points: number | null;
  total_spent: number | null;
}

interface PointsHistory {
  id: string;
  customer_id: string;
  points: number;
  type: string;
  created_at: string;
}

export function LoyaltyAnalytics() {
  const { formatCurrency } = useCurrency();
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pointsHistory, setPointsHistory] = useState<PointsHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [tiersRes, customersRes, historyRes] = await Promise.all([
        supabase.from('loyalty_tiers').select('*').order('min_points'),
        supabase.from('customers').select('*'),
        supabase.from('loyalty_points_history').select('*').order('created_at', { ascending: false }).limit(100),
      ]);

      setTiers(tiersRes.data || []);
      setCustomers(customersRes.data || []);
      setPointsHistory(historyRes.data || []);
    } catch (error) {
      console.error('Error fetching loyalty data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate tier distribution
  const getCustomerTier = (points: number) => {
    const sortedTiers = [...tiers].sort((a, b) => b.min_points - a.min_points);
    return sortedTiers.find(t => points >= t.min_points) || tiers[0];
  };

  const tierDistribution = tiers.map(tier => {
    const count = customers.filter(c => {
      const customerTier = getCustomerTier(c.loyalty_points || 0);
      return customerTier?.id === tier.id;
    }).length;
    return {
      name: tier.name,
      value: count,
      color: tier.color || '#667eea',
    };
  }).filter(t => t.value > 0);

  // Calculate total stats
  const totalPoints = customers.reduce((sum, c) => sum + (c.loyalty_points || 0), 0);
  const totalMembersWithPoints = customers.filter(c => (c.loyalty_points || 0) > 0).length;
  const avgPointsPerMember = totalMembersWithPoints > 0 ? totalPoints / totalMembersWithPoints : 0;
  
  // Points earned vs redeemed
  const earnedPoints = pointsHistory.filter(h => h.type === 'earned').reduce((sum, h) => sum + h.points, 0);
  const redeemedPoints = pointsHistory.filter(h => h.type === 'redeemed').reduce((sum, h) => sum + Math.abs(h.points), 0);

  // Points trend over time (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date.toISOString().split('T')[0];
  });

  const pointsTrend = last7Days.map(date => {
    const dayHistory = pointsHistory.filter(h => h.created_at.startsWith(date));
    const earned = dayHistory.filter(h => h.type === 'earned').reduce((sum, h) => sum + h.points, 0);
    const redeemed = dayHistory.filter(h => h.type === 'redeemed').reduce((sum, h) => sum + Math.abs(h.points), 0);
    return {
      date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
      earned,
      redeemed,
    };
  });

  // Top loyalty members
  const topMembers = [...customers]
    .sort((a, b) => (b.loyalty_points || 0) - (a.loyalty_points || 0))
    .slice(0, 5);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Loyalty Analytics</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-1">Track loyalty program performance and member engagement</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <Card className="glass-card">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-3 rounded-xl bg-primary/10">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Active Members</p>
                <p className="text-xl sm:text-2xl font-bold">{totalMembersWithPoints}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-3 rounded-xl bg-success/10">
                <Star className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Points</p>
                <p className="text-xl sm:text-2xl font-bold">{totalPoints.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-3 rounded-xl bg-warning/10">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Avg Points/Member</p>
                <p className="text-xl sm:text-2xl font-bold">{Math.round(avgPointsPerMember).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-3 rounded-xl bg-destructive/10">
                <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-destructive" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Points Redeemed</p>
                <p className="text-xl sm:text-2xl font-bold">{redeemedPoints.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Tier Distribution Pie Chart */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Crown className="w-5 h-5" />
              Member Tier Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tierDistribution.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tierDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {tierDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                No member data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Points Earned vs Redeemed Bar Chart */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Points Activity (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pointsTrend}>
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="earned" name="Earned" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="redeemed" name="Redeemed" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Members & Tier Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Top Loyalty Members */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Award className="w-5 h-5" />
              Top Loyalty Members
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topMembers.length > 0 ? (
              <div className="space-y-3">
                {topMembers.map((member, index) => {
                  const memberTier = getCustomerTier(member.loyalty_points || 0);
                  return (
                    <div key={member.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                      <div className="flex items-center gap-3">
                        <span 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                          style={{ 
                            backgroundColor: `${memberTier?.color || '#667eea'}20`,
                            color: memberTier?.color || '#667eea'
                          }}
                        >
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium text-sm">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{memberTier?.name} Member</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">{(member.loyalty_points || 0).toLocaleString()} pts</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(Number(member.total_spent) || 0)} spent</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No loyalty members yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tier Breakdown */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Crown className="w-5 h-5" />
              Tier Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tiers.map(tier => {
                const tierMembers = customers.filter(c => {
                  const customerTier = getCustomerTier(c.loyalty_points || 0);
                  return customerTier?.id === tier.id;
                });
                const tierTotalSpent = tierMembers.reduce((sum, c) => sum + (Number(c.total_spent) || 0), 0);
                const percentage = customers.length > 0 ? (tierMembers.length / customers.length) * 100 : 0;

                return (
                  <div key={tier.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: tier.color || '#667eea' }}
                        />
                        <span className="font-medium text-sm">{tier.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-sm">{tierMembers.length}</span>
                        <span className="text-xs text-muted-foreground ml-1">members</span>
                      </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${percentage}%`,
                          backgroundColor: tier.color || '#667eea'
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{tier.min_points}+ pts required</span>
                      <span>{formatCurrency(tierTotalSpent)} total spent</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
