import { useState, useEffect } from 'react';
import { Package, Truck, CheckCircle, Clock, Search, RefreshCw, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/useCurrency';
import { UPIVerificationPanel } from './UPIVerificationPanel';
import { UPIAnalyticsDashboard } from './UPIAnalyticsDashboard';

interface Order {
  id: string;
  tracking_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  status: string;
  delivery_fee: number | null;
  estimated_delivery: string | null;
  created_at: string;
  updated_at: string;
  status_history: StatusHistoryItem[];
  transaction: {
    total: number;
    subtotal: number;
    tax: number;
  } | null;
  delivery_partner: {
    name: string;
  } | null;
}

interface StatusHistoryItem {
  status: string;
  timestamp: string;
  message: string;
}

const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-500', icon: Clock },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-blue-500', icon: CheckCircle },
  { value: 'processing', label: 'Processing', color: 'bg-purple-500', icon: Package },
  { value: 'shipped', label: 'Shipped', color: 'bg-indigo-500', icon: Truck },
  { value: 'out_for_delivery', label: 'Out for Delivery', color: 'bg-orange-500', icon: Truck },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-500', icon: CheckCircle },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-500', icon: Clock },
];

export function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          transaction:transactions(total, subtotal, tax),
          delivery_partner:delivery_partners(name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Parse status_history from JSON
      const parsedOrders = (data || []).map(order => ({
        ...order,
        status_history: Array.isArray(order.status_history) 
          ? (order.status_history as unknown as StatusHistoryItem[])
          : [],
        transaction: Array.isArray(order.transaction) ? order.transaction[0] : order.transaction,
        delivery_partner: Array.isArray(order.delivery_partner) ? order.delivery_partner[0] : order.delivery_partner,
      }));
      
      setOrders(parsedOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: 'Error',
        description: 'Failed to load orders',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const filteredOrders = orders.filter(order => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.tracking_number?.toLowerCase().includes(query) ||
      order.customer_name?.toLowerCase().includes(query) ||
      order.customer_email?.toLowerCase().includes(query) ||
      order.customer_phone?.includes(query)
    );
  });

  const handleUpdateStatus = async () => {
    if (!selectedOrder || !newStatus) return;
    
    setIsUpdating(true);
    try {
      const statusInfo = ORDER_STATUSES.find(s => s.value === newStatus);
      const defaultMessage = `Order ${statusInfo?.label.toLowerCase() || newStatus}`;
      
      const newHistoryItem: StatusHistoryItem = {
        status: newStatus,
        timestamp: new Date().toISOString(),
        message: statusMessage || defaultMessage,
      };

      const updatedHistory = [...(selectedOrder.status_history || []), newHistoryItem];

      const { error } = await supabase
        .from('orders')
        .update({
          status: newStatus,
          status_history: JSON.parse(JSON.stringify(updatedHistory)),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      // Send notification if customer has email
      if (selectedOrder.customer_email) {
        await sendStatusNotification(selectedOrder, newStatus, statusMessage || defaultMessage);
      }

      toast({
        title: 'Status Updated',
        description: `Order ${selectedOrder.tracking_number} updated to ${statusInfo?.label}`,
      });

      setIsUpdateDialogOpen(false);
      setSelectedOrder(null);
      setNewStatus('');
      setStatusMessage('');
      fetchOrders();
    } catch (error) {
      console.error('Error updating order:', error);
      toast({
        title: 'Update Failed',
        description: 'Failed to update order status',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const sendStatusNotification = async (order: Order, status: string, message: string) => {
    try {
      const { error } = await supabase.functions.invoke('send-order-notification', {
        body: {
          order_id: order.id,
          tracking_number: order.tracking_number,
          customer_email: order.customer_email,
          customer_name: order.customer_name,
          status,
          message,
        },
      });

      if (error) {
        console.error('Failed to send notification:', error);
      }
    } catch (error) {
      console.error('Notification error:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = ORDER_STATUSES.find(s => s.value === status);
    return (
      <Badge className={`${statusInfo?.color || 'bg-gray-500'} text-white`}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const openUpdateDialog = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setStatusMessage('');
    setIsUpdateDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-bold">Order Management</h2>
          <p className="text-muted-foreground">Manage and track customer orders</p>
        </div>
        <Button onClick={fetchOrders} variant="outline" disabled={isLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by tracking #, name, email, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {ORDER_STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Orders Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Tracking #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No orders found
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <>
                  <TableRow key={order.id} className="hover:bg-muted/50">
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                      >
                        {expandedOrderId === order.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {order.tracking_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{order.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{order.customer_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell className="text-right font-medium">
                      {order.transaction ? formatCurrency(order.transaction.total + (order.delivery_fee || 0)) : '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(order.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => openUpdateDialog(order)}
                      >
                        Update Status
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedOrderId === order.id && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/30 p-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <h4 className="font-semibold mb-2">Order Details</h4>
                            <div className="space-y-1 text-sm">
                              <p><span className="text-muted-foreground">Address:</span> {order.delivery_address || 'N/A'}</p>
                              <p><span className="text-muted-foreground">Phone:</span> {order.customer_phone || 'N/A'}</p>
                              <p><span className="text-muted-foreground">Delivery Partner:</span> {order.delivery_partner?.name || 'N/A'}</p>
                              <p><span className="text-muted-foreground">Estimated Delivery:</span> {order.estimated_delivery || 'N/A'}</p>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-semibold mb-2">Status History</h4>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                              {order.status_history.length > 0 ? (
                                order.status_history.map((entry, idx) => (
                                  <div key={idx} className="flex items-start gap-2 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                                    <div>
                                      <span className="font-medium">{entry.status}</span>
                                      <span className="text-muted-foreground"> - {entry.message}</span>
                                      <p className="text-xs text-muted-foreground">
                                        {new Date(entry.timestamp).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-muted-foreground">No history available</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Update Status Dialog */}
      <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-mono font-medium">{selectedOrder.tracking_number}</p>
                <p className="text-sm text-muted-foreground">{selectedOrder.customer_name}</p>
              </div>

              <div className="space-y-2">
                <Label>New Status</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${status.color}`} />
                          {status.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status Message (Optional)</Label>
                <Textarea
                  placeholder="e.g., Package handed to courier, Expected delivery by 5 PM..."
                  value={statusMessage}
                  onChange={(e) => setStatusMessage(e.target.value)}
                  rows={3}
                />
              </div>

              {selectedOrder.customer_email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Send className="w-4 h-4" />
                  Customer will be notified via email
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpdateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus} disabled={isUpdating || !newStatus}>
              {isUpdating ? 'Updating...' : 'Update Status'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UPI Verification Panel */}
      <div className="glass-card rounded-xl p-6">
        <UPIVerificationPanel />
      </div>

      {/* UPI Analytics */}
      <div className="glass-card rounded-xl p-6">
        <UPIAnalyticsDashboard />
      </div>
    </div>
  );
}
