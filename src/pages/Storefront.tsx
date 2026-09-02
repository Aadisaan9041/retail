import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Product, CartItem, Category } from '@/types/retail';
import { Header } from '@/components/storefront/Header';
import { ProductCard } from '@/components/storefront/ProductCard';
import { CartDrawer } from '@/components/storefront/CartDrawer';
import { ProductDetailModal } from '@/components/storefront/ProductDetailModal';
import { CategoryFilter } from '@/components/storefront/CategoryFilter';
import { Footer } from '@/components/storefront/Footer';
import { MobileBottomNav } from '@/components/storefront/MobileBottomNav';
import { AISearchAssistant } from '@/components/storefront/AISearchAssistant';
import { CustomerSupportChat } from '@/components/storefront/CustomerSupportChat';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Package, Sparkles } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';

type LocalStoreSettings = {
  storeName: string;
  storeDescription: string;
  merchantVPA: string;
  email: string;
  phone: string;
  address: string;
};

const STORE_DEFAULTS: LocalStoreSettings = {
  storeName: 'My Store',
  storeDescription: 'Discover quality products at great prices.',
  merchantVPA: 'merchant@upi',
  email: '',
  phone: '',
  address: '',
};

export default function Storefront() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('storefront-cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showAISearch, setShowAISearch] = useState(false);
  const { toast } = useToast();

  const [storeSettings, setStoreSettings] = useState<LocalStoreSettings>(STORE_DEFAULTS);

  // Fetch settings from database (public read via app_settings)
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', ['appSettings', 'webstoreSettings']);

        if (!data || data.length === 0) return;

        const appRow = data.find((r) => r.key === 'appSettings');
        const webRow = data.find((r) => r.key === 'webstoreSettings');

        const app = (appRow?.value ?? {}) as Record<string, string>;
        const web = (webRow?.value ?? {}) as Record<string, string>;

        setStoreSettings({
          storeName: web.storeName || app.appName || STORE_DEFAULTS.storeName,
          storeDescription: web.storeDescription || STORE_DEFAULTS.storeDescription,
          merchantVPA: web.webstoreUpiId || STORE_DEFAULTS.merchantVPA,
          email: app.contactEmail || STORE_DEFAULTS.email,
          phone: app.contactPhone || STORE_DEFAULTS.phone,
          address: app.address || STORE_DEFAULTS.address,
        });
      } catch (err) {
        console.error('Failed to fetch store settings:', err);
      }
    };
    fetchSettings();
  }, []);

  // Persist cart to localStorage
  useEffect(() => {
    localStorage.setItem('storefront-cart', JSON.stringify(cart));
  }, [cart]);

  // Fetch public products and categories
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch categories
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      setCategories(categoriesData || []);

      // Fetch products with category names (public access)
      const { data: productsData } = await supabase
        .from('products')
        .select(`
          *,
          categories(name)
        `)
        .gt('quantity', 0)
        .order('name');

      const productsWithCategory = productsData?.map((p) => ({
        ...p,
        category: p.categories?.name || 'Uncategorized',
      })) || [];

      setProducts(productsWithCategory);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Cart functions
  const addToCart = useCallback((product: Product, quantity: number = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        const newQuantity = Math.min(
          existing.quantity + quantity,
          product.quantity
        );
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: newQuantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });

    toast({
      title: 'Added to cart',
      description: `${product.name} added to your cart`,
    });
  }, [toast]);

  const updateCartQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const calculateCartTotal = useCallback(() => {
    const subtotal = cart.reduce(
      (sum, item) => sum + Number(item.product.price) * item.quantity,
      0
    );
    const tax = subtotal * 0.18; // 18% GST
    const total = subtotal + tax;
    return { subtotal, tax, discount: 0, total, pointsEarned: 0 };
  }, [cart]);

  const handleCheckout = async (paymentMethod: 'cash' | 'card' | 'other') => {
    // Use secure edge function for guest checkout to prevent fraud
    try {
      // Prepare cart items for secure checkout
      const items = cart.map((item) => ({
        product_id: item.product.id,
        quantity: item.quantity,
      }));

      // Call the secure storefront-checkout edge function
      const { data, error } = await supabase.functions.invoke('storefront-checkout', {
        body: {
          items,
          customer: {
            name: 'Guest Customer',
            address: 'Guest Checkout - No Delivery',
          },
          payment_method: paymentMethod === 'card' ? 'card' : 'upi',
        },
      });

      if (error) {
        console.error('Checkout error:', error);
        toast({
          title: 'Checkout Failed',
          description: error.message || 'There was an error processing your order.',
          variant: 'destructive',
        });
        return null;
      }

      if (!data?.success) {
        console.error('Checkout failed:', data?.error);
        toast({
          title: 'Checkout Failed',
          description: data?.error || 'There was an error processing your order.',
          variant: 'destructive',
        });
        return null;
      }

      clearCart();
      toast({
        title: 'Order Placed!',
        description: `Thank you for your purchase. Order #${data.order?.tracking_number || 'confirmed'}`,
      });

      return data.transaction;
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'Checkout Failed',
        description: 'There was an error processing your order.',
        variant: 'destructive',
      });
      return null;
    }
  };

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <>
      <Helmet>
        <title>{storeSettings.storeName} - Shop Quality Products Online</title>
        <meta
          name="description"
          content={`Shop at ${storeSettings.storeName} for quality products at great prices. Fast UPI payments, easy checkout.`}
        />
      </Helmet>

      <div className="min-h-screen bg-background flex flex-col pb-16 lg:pb-0">
        <Header
          cartItemCount={cartItemCount}
          onCartClick={() => setCartOpen(true)}
          onSearchChange={setSearchQuery}
          searchQuery={searchQuery}
          storeName={storeSettings.storeName}
        />

        <main className="flex-1 container px-4 py-8">
          {/* Hero Section */}
          <section className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gradient">
              Welcome to {storeSettings.storeName}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              {storeSettings.storeDescription}
            </p>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setShowAISearch(!showAISearch)}
            >
              <Sparkles className="h-4 w-4" />
              {showAISearch ? 'Hide AI Search' : 'Try AI-Powered Search'}
            </Button>
          </section>

          {/* AI Search Assistant */}
          {showAISearch && (
            <section className="mb-8 max-w-2xl mx-auto">
              <AISearchAssistant
                onProductSelect={(product) => {
                  setSelectedProduct(product);
                  setShowAISearch(false);
                }}
                onClose={() => setShowAISearch(false)}
              />
            </section>
          )}

          {/* Categories */}
          <section className="mb-8">
            <CategoryFilter
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </section>

          {/* Products Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No products found</h3>
              <p className="text-muted-foreground">
                {searchQuery
                  ? 'Try adjusting your search or filters'
                  : 'Check back later for new products'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAddToCart={addToCart}
                  onViewDetails={setSelectedProduct}
                />
              ))}
            </div>
          )}
        </main>

        <Footer
          storeName={storeSettings.storeName}
          email={storeSettings.email}
          phone={storeSettings.phone}
          address={storeSettings.address}
        />

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav
          cartItemCount={cartItemCount}
          onCartClick={() => setCartOpen(true)}
          onSearchClick={() => {
            // Focus on the search input in header
            const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search"]') as HTMLInputElement;
            if (searchInput) {
              searchInput.focus();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        />

        {/* Cart Drawer */}
        <CartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          cart={cart}
          onUpdateQuantity={updateCartQuantity}
          onRemoveItem={removeFromCart}
          onClearCart={clearCart}
          onCheckout={handleCheckout}
          cartTotal={calculateCartTotal()}
          merchantVPA={storeSettings.merchantVPA}
          merchantName={storeSettings.storeName}
        />

        {/* Product Detail Modal */}
        <ProductDetailModal
          product={selectedProduct}
          open={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={(product, quantity) => {
            addToCart(product, quantity);
          }}
        />

        {/* Customer Support Chat */}
        <CustomerSupportChat />
      </div>
    </>
  );
}
