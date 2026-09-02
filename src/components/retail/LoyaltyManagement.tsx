import { useState, useEffect } from 'react';
import { Crown, Star, Gift, History, TrendingUp, Settings, Plus, Minus, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Customer } from '@/types/retail';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LoyaltyTier {
  id: string;
  name: string;
  min_points: number;
  discount_percentage: number;
  benefits: string[];
  color: string;
}

interface PointsHistory {
  id: string;
  customer_id: string;
  points: number;
  type: string;
  description: string | null;
  transaction_id: string | null;
  created_at: string;
}

interface LoyaltyManagementProps {
  customers: Customer[];
  onRefresh: () => void;
}

export function LoyaltyManagement({ customers, onRefresh }: LoyaltyManagementProps) {
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [pointsHistory, setPointsHistory] = useState<PointsHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [adjustPoints, setAdjustPoints] = useState(0);
  const [adjustType, setAdjustType] = useState<'bonus' | 'adjustment'>('bonus');
  const [adjustReason, setAdjustReason] = useState('');
  const [editTierDialogOpen, setEditTierDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<LoyaltyTier | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchTiers();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      fetchPointsHistory(selectedCustomer.id);
    }
  }, [selectedCustomer]);

  const fetchTiers = async () => {
    const { data, error } = await supabase
      .from('loyalty_tiers')
      .select('*')
      .order('min_points', { ascending: true });

    if (error) {
      console.error('Error fetching tiers:', error);
    } else {
      setTiers(data || []);
    }
    setIsLoading(false);
  };

  const fetchPointsHistory = async (customerId: string) => {
    const { data, error } = await supabase
      .from('loyalty_points_history')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching points history:', error);
    } else {
      setPointsHistory(data || []);
    }
  };

  const getCustomerTier = (points: number): LoyaltyTier | undefined => {
    return [...tiers].reverse().find(tier => points >= tier.min_points);
  };

  const getNextTier = (points: number): LoyaltyTier | undefined => {
    return tiers.find(tier => points < tier.min_points);
  };

  const handleAdjustPoints = async () => {
    if (!selectedCustomer || adjustPoints === 0) return;

    try {
      // Update customer points
      const newPoints = selectedCustomer.loyalty_points + (adjustType === 'adjustment' ? adjustPoints : Math.abs(adjustPoints));
      
      const { error: updateError } = await supabase
        .from('customers')
        .update({ loyalty_points: Math.max(0, newPoints) })
        .eq('id', selectedCustomer.id);

      if (updateError) throw updateError;

      // Add to history
      const { error: historyError } = await supabase
        .from('loyalty_points_history')
        .insert({
          customer_id: selectedCustomer.id,
          points: adjustPoints,
          type: adjustType,
          description: adjustReason || `${adjustType === 'bonus' ? 'Bonus' : 'Adjustment'}: ${adjustPoints > 0 ? '+' : ''}${adjustPoints} points`,
        });

      if (historyError) throw historyError;

      toast({
        title: 'Points Updated',
        description: `${adjustPoints > 0 ? 'Added' : 'Removed'} ${Math.abs(adjustPoints)} points`,
      });

      setAdjustDialogOpen(false);
      setAdjustPoints(0);
      setAdjustReason('');
      onRefresh();
      fetchPointsHistory(selectedCustomer.id);
    } catch (error) {
      console.error('Error adjusting points:', error);
      toast({
        title: 'Error',
        description: 'Failed to adjust points',
        variant: 'destructive',
      });
    }
  };

  const handleUpdateTier = async () => {
    if (!editingTier) return;

    try {
      const { error } = await supabase
        .from('loyalty_tiers')
        .update({
          name: editingTier.name,
          min_points: editingTier.min_points,
          discount_percentage: editingTier.discount_percentage,
          color: editingTier.color,
        })
        .eq('id', editingTier.id);

      if (error) throw error;

      toast({
        title: 'Tier Updated',
        description: `${editingTier.name} tier has been updated`,
      });

      setEditTierDialogOpen(false);
      setEditingTier(null);
      fetchTiers();
    } catch (error) {
      console.error('Error updating tier:', error);
      toast({
        title: 'Error',
        description: 'Failed to update tier',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Crown className="w-6 h-6 sm:w-8 sm:h-8 text-warning" />
          Loyalty Program
        </h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Manage reward tiers and customer points
        </p>
      </div>

      <Tabs defaultValue="tiers" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="tiers" className="text-xs sm:text-sm">
            <Crown className="w-4 h-4 mr-1 sm:mr-2" />
            Tiers
          </TabsTrigger>
          <TabsTrigger value="customers" className="text-xs sm:text-sm">
            <Star className="w-4 h-4 mr-1 sm:mr-2" />
            Members
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm">
            <History className="w-4 h-4 mr-1 sm:mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Tiers Tab */}
        <TabsContent value="tiers" className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className="glass-card rounded-xl p-4 sm:p-6 relative overflow-hidden"
                style={{ borderColor: tier.color, borderWidth: 2 }}
              >
                <div
                  className="absolute top-0 right-0 w-24 h-24 opacity-10"
                  style={{ background: `radial-gradient(circle at top right, ${tier.color}, transparent)` }}
                />
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${tier.color}20` }}
                  >
                    <Crown className="w-5 h-5" style={{ color: tier.color }} />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingTier(tier);
                      setEditTierDialogOpen(true);
                    }}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
                <h3 className="font-bold text-lg" style={{ color: tier.color }}>
                  {tier.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {tier.min_points.toLocaleString()}+ points
                </p>
                <div className="space-y-2">
                  <Badge
                    variant="secondary"
                    className="text-xs"
                    style={{ backgroundColor: `${tier.color}20`, color: tier.color }}
                  >
                    {tier.discount_percentage}% discount
                  </Badge>
                  <ul className="text-xs text-muted-foreground space-y-1 mt-2">
                    {tier.benefits?.slice(0, 3).map((benefit, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <Gift className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: tier.color }} />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Customer List */}
            <div className="glass-card rounded-xl p-4 sm:p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Star className="w-4 h-4 text-warning" />
                Loyalty Members ({customers.length})
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {customers.map((customer) => {
                  const tier = getCustomerTier(customer.loyalty_points || 0);
                  return (
                    <button
                      key={customer.id}
                      onClick={() => setSelectedCustomer(customer)}
                      className={cn(
                        'w-full p-3 rounded-lg text-left transition-all',
                        selectedCustomer?.id === customer.id
                          ? 'bg-primary/10 border border-primary'
                          : 'bg-secondary/50 hover:bg-secondary'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{customer.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {customer.email || customer.phone}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <Badge
                            className="text-xs"
                            style={{
                              backgroundColor: tier ? `${tier.color}20` : undefined,
                              color: tier?.color,
                              borderColor: tier?.color,
                            }}
                          >
                            {tier?.name || 'New'}
                          </Badge>
                          <p className="text-xs font-semibold mt-1">
                            {(customer.loyalty_points || 0).toLocaleString()} pts
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Customer Details */}
            <div className="glass-card rounded-xl p-4 sm:p-6">
              {selectedCustomer ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">{selectedCustomer.name}</h3>
                    <Button size="sm" onClick={() => setAdjustDialogOpen(true)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Adjust Points
                    </Button>
                  </div>

                  {/* Tier Progress */}
                  {(() => {
                    const currentTier = getCustomerTier(selectedCustomer.loyalty_points || 0);
                    const nextTier = getNextTier(selectedCustomer.loyalty_points || 0);
                    const progress = nextTier
                      ? ((selectedCustomer.loyalty_points || 0) - (currentTier?.min_points || 0)) /
                        (nextTier.min_points - (currentTier?.min_points || 0)) * 100
                      : 100;

                    return (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-2">
                          <Badge
                            style={{
                              backgroundColor: currentTier ? `${currentTier.color}20` : undefined,
                              color: currentTier?.color,
                            }}
                          >
                            {currentTier?.name || 'New Member'}
                          </Badge>
                          {nextTier && (
                            <span className="text-xs text-muted-foreground">
                              {(nextTier.min_points - (selectedCustomer.loyalty_points || 0)).toLocaleString()} pts to {nextTier.name}
                            </span>
                          )}
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(progress, 100)}%`,
                              backgroundColor: currentTier?.color || '#667eea',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })()}

                  {/* Points Summary */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 rounded-lg bg-primary/10 text-center">
                      <p className="text-2xl font-bold text-primary">
                        {(selectedCustomer.loyalty_points || 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Current Points</p>
                    </div>
                    <div className="p-3 rounded-lg bg-success/10 text-center">
                      <p className="text-2xl font-bold text-success">
                        ${(Number(selectedCustomer.total_spent) || 0).toFixed(0)}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Spent</p>
                    </div>
                  </div>

                  {/* Recent History */}
                  <h4 className="font-medium text-sm mb-2">Recent Activity</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {pointsHistory.slice(0, 10).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-2 rounded bg-secondary/30 text-xs"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{entry.description || entry.type}</p>
                          <p className="text-muted-foreground">{formatDate(entry.created_at)}</p>
                        </div>
                        <Badge
                          variant={entry.points > 0 ? 'default' : 'destructive'}
                          className="flex-shrink-0 ml-2"
                        >
                          {entry.points > 0 ? '+' : ''}{entry.points}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Select a customer to view details</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          <div className="glass-card rounded-xl p-4 sm:p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <History className="w-4 h-4" />
              All Points Activity
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3">Customer</th>
                    <th className="text-left py-2 px-3">Type</th>
                    <th className="text-left py-2 px-3">Description</th>
                    <th className="text-right py-2 px-3">Points</th>
                    <th className="text-right py-2 px-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.flatMap(customer => 
                    pointsHistory
                      .filter(h => h.customer_id === customer.id)
                      .slice(0, 5)
                      .map(entry => (
                        <tr key={entry.id} className="border-b border-border/50">
                          <td className="py-2 px-3 font-medium">{customer.name}</td>
                          <td className="py-2 px-3">
                            <Badge variant="outline" className="text-xs capitalize">
                              {entry.type}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground truncate max-w-[200px]">
                            {entry.description || '-'}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className={entry.points > 0 ? 'text-success' : 'text-destructive'}>
                              {entry.points > 0 ? '+' : ''}{entry.points}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-muted-foreground text-xs">
                            {formatDate(entry.created_at)}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Adjust Points Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Adjust Points - {selectedCustomer?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={adjustType} onValueChange={(v) => setAdjustType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonus">Bonus Points</SelectItem>
                  <SelectItem value="adjustment">Manual Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Points</Label>
              <Input
                type="number"
                value={adjustPoints}
                onChange={(e) => setAdjustPoints(Number(e.target.value))}
                placeholder="Enter points (use negative to deduct)"
              />
            </div>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Input
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g., Birthday bonus, Referral reward"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAdjustPoints}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tier Dialog */}
      <Dialog open={editTierDialogOpen} onOpenChange={setEditTierDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Edit Tier</DialogTitle>
          </DialogHeader>
          {editingTier && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tier Name</Label>
                <Input
                  value={editingTier.name}
                  onChange={(e) => setEditingTier({ ...editingTier, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Minimum Points</Label>
                <Input
                  type="number"
                  value={editingTier.min_points}
                  onChange={(e) => setEditingTier({ ...editingTier, min_points: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Discount Percentage</Label>
                <Input
                  type="number"
                  value={editingTier.discount_percentage}
                  onChange={(e) => setEditingTier({ ...editingTier, discount_percentage: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <Input
                  type="color"
                  value={editingTier.color}
                  onChange={(e) => setEditingTier({ ...editingTier, color: e.target.value })}
                  className="h-10"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTierDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateTier}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
