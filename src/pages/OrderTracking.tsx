import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Package, Truck, CheckCircle, Clock, MapPin, ArrowLeft, Search, Mail, Home, ShoppingCart, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCurrency } from '@/hooks/useCurrency';
import { Helmet } from 'react-helmet-async';
import { cn } from '@/lib/utils';

interface StatusHistoryItem {
  status: string;
  timestamp: string;
  message?: string;
}

interface DeliveryPartner {
  name: string;
  phone: string;
}

interface Order {
  id: string;
  tracking_number: string;
  status: string;
  customer_name: string;
  delivery_address: string;
  delivery_fee: number;
  estimated_delivery: string | null;
  status_history: StatusHistoryItem[] | null;
  created_at: string;
  delivery_partners?: DeliveryPartner | null;
}

const STATUS_STEPS = [
  { key: 'pending', label: 'Order Placed', icon: Package },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { key: 'processing', label: 'Processing', icon: Clock },
  { key: 'shipped', label: 'Shipped', icon: Truck },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: MapPin },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle },
];

export default function OrderTracking() {
  const [searchParams] = useSearchParams();
  const [trackingInput, setTrackingInput] = useState(searchParams.get('tracking') || '');
  const [emailInput, setEmailInput] = useState(searchParams.get('email') || '');
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { formatCurrency } = useCurrency();

  const fetchOrder = async (trackingNumber: string, customerEmail: string) => {
    if (!trackingNumber.trim() || !customerEmail.trim()) {
      setError('Please provide both tracking number and email address.');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Use secure edge function instead of direct database query
      const { data, error: fetchError } = await supabase.functions.invoke('track-order', {
        body: {
          tracking_number: trackingNumber.trim(),
          customer_email: customerEmail.trim(),
        },
      });

      if (fetchError) {
        console.error('Order tracking error:', fetchError);
        setError('Error fetching order details. Please try again.');
        setOrder(null);
      } else if (!data?.success || !data?.order) {
        setError(data?.error || 'Order not found or email does not match.');
        setOrder(null);
      } else {
        // Parse status_history from JSONB
        const orderData = {
          ...data.order,
          status_history: Array.isArray(data.order.status_history) 
            ? (data.order.status_history as StatusHistoryItem[])
            : [],
        };
        setOrder(orderData as Order);
      }
    } catch (err) {
      console.error('Order tracking exception:', err);
      setError('Unable to track order. Please try again later.');
      setOrder(null);
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    const tracking = searchParams.get('tracking');
    const email = searchParams.get('email');
    if (tracking && email) {
      fetchOrder(tracking, email);
    }
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrder(trackingInput, emailInput);
  };

  const getCurrentStepIndex = () => {
    if (!order) return 0;
    const index = STATUS_STEPS.findIndex((s) => s.key === order.status);
    return index >= 0 ? index : 0;
  };

  return (
    <>
      <Helmet>
        <title>Track Your Order</title>
        <meta name="description" content="Track your order status and delivery in real-time." />
      </Helmet>

      <div className="min-h-screen bg-background pb-16 lg:pb-0">
        <div className="container max-w-2xl px-4 py-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Track Your Order</h1>
              <p className="text-muted-foreground">Enter your tracking number and email to see order status</p>
            </div>
          </div>

          {/* Search Form */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Enter tracking number (e.g., ORD-ABC123)"
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Enter email address used for order"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                      Tracking...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Track Order
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Error */}
          {error && !isLoading && (
            <Card className="border-destructive/50 bg-destructive/5 mb-6">
              <CardContent className="pt-6 text-center">
                <Package className="w-12 h-12 mx-auto mb-4 text-destructive opacity-50" />
                <p className="text-destructive">{error}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Make sure you're using the email address associated with your order.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Order Details */}
          {order && !isLoading && (
            <div className="space-y-6">
              {/* Order Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Order #{order.tracking_number}</span>
                    <span className={`text-sm px-3 py-1 rounded-full ${
                      order.status === 'delivered' 
                        ? 'bg-success/20 text-success' 
                        : 'bg-primary/20 text-primary'
                    }`}>
                      {STATUS_STEPS.find((s) => s.key === order.status)?.label || order.status}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Customer</p>
                      <p className="font-medium">{order.customer_name || 'Guest'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Order Date</p>
                      <p className="font-medium">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {order.delivery_address && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Delivery Address</p>
                        <p className="font-medium">{order.delivery_address}</p>
                      </div>
                    )}
                    {order.delivery_partners && (
                      <div>
                        <p className="text-muted-foreground">Delivery Partner</p>
                        <p className="font-medium">{order.delivery_partners.name}</p>
                      </div>
                    )}
                    {order.estimated_delivery && (
                      <div>
                        <p className="text-muted-foreground">Estimated Delivery</p>
                        <p className="font-medium">{order.estimated_delivery}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Progress Tracker */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Order Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    {STATUS_STEPS.map((step, index) => {
                      const StepIcon = step.icon;
                      const currentIndex = getCurrentStepIndex();
                      const isCompleted = index <= currentIndex;
                      const isCurrent = index === currentIndex;

                      return (
                        <div key={step.key} className="flex items-start gap-4 pb-8 last:pb-0">
                          {/* Line */}
                          {index < STATUS_STEPS.length - 1 && (
                            <div
                              className={`absolute left-4 top-10 w-0.5 h-8 -translate-x-1/2 ${
                                index < currentIndex ? 'bg-primary' : 'bg-border'
                              }`}
                              style={{ top: `${index * 72 + 32}px` }}
                            />
                          )}
                          
                          {/* Icon */}
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              isCompleted
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-muted-foreground'
                            } ${isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                          >
                            <StepIcon className="w-4 h-4" />
                          </div>

                          {/* Content */}
                          <div className="flex-1">
                            <p className={`font-medium ${isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {step.label}
                            </p>
                            {isCurrent && order.status_history && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(
                                  order.status_history.find((h) => h.status === step.key)?.timestamp || order.created_at
                                ).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Status History */}
              {order.status_history && order.status_history.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Status History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[...order.status_history].reverse().map((history, index) => (
                        <div key={index} className="flex items-start gap-3 text-sm">
                          <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                          <div>
                            <p className="font-medium capitalize">{history.status.replace(/_/g, ' ')}</p>
                            {history.message && (
                              <p className="text-muted-foreground">{history.message}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {new Date(history.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border">
          <div className="flex items-center justify-around h-16 px-2">
            <Link to="/" className="flex flex-col items-center justify-center flex-1 h-full group">
              <Home className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-[10px] mt-1 text-muted-foreground group-hover:text-primary transition-colors">Home</span>
            </Link>
            <Link to="/track-order" className="flex flex-col items-center justify-center flex-1 h-full group">
              <Package className="w-5 h-5 text-primary transition-colors" />
              <span className="text-[10px] mt-1 text-primary font-medium transition-colors">Track</span>
            </Link>
            <Link to="/" className="flex flex-col items-center justify-center flex-1 h-full group relative">
              <ShoppingCart className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-[10px] mt-1 text-muted-foreground group-hover:text-primary transition-colors">Cart</span>
            </Link>
            <Link to="/auth" className="flex flex-col items-center justify-center flex-1 h-full group">
              <User className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-[10px] mt-1 text-muted-foreground group-hover:text-primary transition-colors">Account</span>
            </Link>
          </div>
        </nav>
      </div>
    </>
  );
}
