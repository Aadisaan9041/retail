import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2, ShoppingBag, User, MapPin, CreditCard, Heart, Clock, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useStoreName } from '@/hooks/useStoreName';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/toaster';

type CustomerTab = 'orders' | 'profile' | 'addresses' | 'wishlist';

const CustomerDashboard = () => {
  const [activeTab, setActiveTab] = useState<CustomerTab>('orders');
  const { user, isLoading: authLoading, isCustomer, isStaff, profile, signOut } = useAuth();
  const { storeName } = useStoreName();

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

  // Staff should go to their respective dashboards
  if (isStaff) {
    return <Navigate to="/admin" replace />;
  }

  // If not customer and not staff, show access pending
  if (!isCustomer && !authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-md p-6 sm:p-8 glass-card rounded-2xl w-full">
          <h2 className="text-xl sm:text-2xl font-bold mb-4">Account Setup Pending</h2>
          <p className="text-muted-foreground mb-6 text-sm sm:text-base">
            Your account has been created. Please wait while we set up your customer profile.
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold text-lg">{storeName}</h1>
              <p className="text-xs text-muted-foreground">Customer Portal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="font-medium text-sm">{profile?.full_name || 'Customer'}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => signOut()}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">Welcome back, {profile?.full_name?.split(' ')[0] || 'Customer'}!</h2>
          <p className="text-muted-foreground">Manage your orders, profile, and preferences</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CustomerTab)} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full max-w-lg">
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="hidden sm:inline">Orders</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="addresses" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span className="hidden sm:inline">Addresses</span>
            </TabsTrigger>
            <TabsTrigger value="wishlist" className="flex items-center gap-2">
              <Heart className="w-4 h-4" />
              <span className="hidden sm:inline">Wishlist</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Order History
                </CardTitle>
                <CardDescription>View and track your orders</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No orders yet</p>
                  <p className="text-sm">Start shopping to see your orders here</p>
                  <Button className="mt-4" onClick={() => window.location.href = '/'}>
                    Browse Products
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>Update your personal details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                    <p className="font-medium">{profile?.full_name || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p className="font-medium">{user.email}</p>
                  </div>
                </div>
                <Button variant="outline">Edit Profile</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Loyalty Points
                </CardTitle>
                <CardDescription>Your rewards balance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-bold text-primary">0</div>
                  <div>
                    <p className="font-medium">Points Available</p>
                    <p className="text-sm text-muted-foreground">Earn points with every purchase</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="addresses" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Saved Addresses
                </CardTitle>
                <CardDescription>Manage your delivery addresses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No addresses saved</p>
                  <p className="text-sm">Add an address for faster checkout</p>
                  <Button className="mt-4" variant="outline">Add Address</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wishlist" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Heart className="w-5 h-5" />
                  Wishlist
                </CardTitle>
                <CardDescription>Items you've saved for later</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Heart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Your wishlist is empty</p>
                  <p className="text-sm">Save items you love for later</p>
                  <Button className="mt-4" onClick={() => window.location.href = '/'}>
                    Browse Products
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Toaster />
    </div>
  );
};

export default CustomerDashboard;