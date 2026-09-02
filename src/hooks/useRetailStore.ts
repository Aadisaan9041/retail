import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Product, Transaction, TransactionItem, CartItem, DashboardMetrics, Customer, Category, ReorderRequest } from '@/types/retail';

export function useRetailStore() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [reorderRequests, setReorderRequests] = useState<ReorderRequest[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!user) return;
    
    setIsLoading(true);
    
    try {
      // Fetch categories
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .order('name');
      
      setCategories(categoriesData || []);

      // Fetch products with category names
      const { data: productsData } = await supabase
        .from('products')
        .select(`
          *,
          categories(name)
        `)
        .order('name');
      
      const productsWithCategory = productsData?.map(p => ({
        ...p,
        category: p.categories?.name || 'Uncategorized',
      })) || [];
      
      setProducts(productsWithCategory);

      // Fetch customers
      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .order('name');
      
      setCustomers(customersData || []);

      // Fetch transactions with items
      const { data: transactionsData } = await supabase
        .from('transactions')
        .select(`
          *,
          customers(*)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (transactionsData) {
        // Fetch transaction items for each transaction
        const transactionsWithItems = await Promise.all(
          transactionsData.map(async (t) => {
            const { data: items } = await supabase
              .from('transaction_items')
              .select('*')
              .eq('transaction_id', t.id);
            
            return {
              ...t,
              payment_method: t.payment_method as 'cash' | 'card' | 'other',
              customer: t.customers,
              items: items || [],
            };
          })
        );
        setTransactions(transactionsWithItems as Transaction[]);
      }

      // Fetch reorder requests
      const { data: reordersData } = await supabase
        .from('reorder_requests')
        .select(`
          *,
          products(*)
        `)
        .order('created_at', { ascending: false });
      
      const reordersWithProducts = reordersData?.map(r => ({
        ...r,
        product: r.products,
      })) || [];
      
      setReorderRequests(reordersWithProducts);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Cart functions
  const addToCart = useCallback((product: Product, variant?: import('@/types/marketplace').ProductVariant) => {
    setCart(prev => {
      const key = variant?.id ? `${product.id}:${variant.id}` : product.id;
      const existing = prev.find(item => {
        const itemKey = item.variant?.id ? `${item.product.id}:${item.variant.id}` : item.product.id;
        return itemKey === key;
      });
      const available = variant?.quantity ?? product.quantity;
      if (existing) {
        if (existing.quantity >= available) return prev;
        return prev.map(item => {
          const itemKey = item.variant?.id ? `${item.product.id}:${item.variant.id}` : item.product.id;
          return itemKey === key ? { ...item, quantity: item.quantity + 1 } : item;
        });
      }
      return [...prev, { product, variant, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((productKey: string) => {
    setCart(prev => prev.filter(item => {
      const key = item.variant?.id ? `${item.product.id}:${item.variant.id}` : item.product.id;
      return key !== productKey;
    }));
  }, []);

  const updateCartQuantity = useCallback((productKey: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productKey);
      return;
    }
    setCart(prev => prev.map(item => {
      const key = item.variant?.id ? `${item.product.id}:${item.variant.id}` : item.product.id;
      return key === productKey ? { ...item, quantity } : item;
    }));
  }, [removeFromCart]);

  // Update custom price for a cart item
  const updateCartItemPrice = useCallback((productKey: string, customPrice: number | undefined) => {
    setCart(prev =>
      prev.map(item => {
        const key = item.variant?.id ? `${item.product.id}:${item.variant.id}` : item.product.id;
        return key === productKey ? { ...item, customPrice } : item;
      })
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setSelectedCustomer(null);
  }, []);

  const calculateCartTotal = useCallback((loyaltyPointsToRedeem: number = 0) => {
    const subtotal = cart.reduce((sum, item) => {
      const price = item.customPrice ?? Number(item.variant?.price ?? item.product.price);
      return sum + price * item.quantity;
    }, 0);
    const discount = loyaltyPointsToRedeem * 0.01; // 1 point = $0.01
    const taxableAmount = subtotal - discount;
    const tax = taxableAmount * 0.08;
    const total = taxableAmount + tax;
    const pointsEarned = Math.floor(total); // 1 point per dollar spent
    
    return { subtotal, tax, discount, total: Math.max(0, total), pointsEarned };
  }, [cart]);

  // Transaction functions
  const processTransaction = useCallback(async (
    paymentMethod: 'cash' | 'card' | 'other',
    loyaltyPointsRedeemed: number = 0
  ) => {
    if (!user || cart.length === 0) return null;
    
    const { subtotal, tax, discount, total, pointsEarned } = calculateCartTotal(loyaltyPointsRedeemed);

    // Bill-level gross-profit protection: individual items may be below cost,
    // but the completed bill may not fall below the configured minimum profit.
    const billCost = cart.reduce((sum, item) => {
      const unitCost = item.variant ? Number(item.variant.cost) : Number(item.product.cost);
      return sum + unitCost * item.quantity;
    }, 0);
    const grossProfit = subtotal - billCost - discount;
    const { data: profitSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'minimum_bill_gross_profit')
      .maybeSingle();
    const minimumProfit = Number((profitSetting?.value as any)?.amount ?? profitSetting?.value ?? 0);
    if (grossProfit < minimumProfit) {
      console.warn('Transaction blocked by bill-level profit protection', { grossProfit, minimumProfit });
      return { blocked: true, reason: `Bill gross profit ${grossProfit.toFixed(2)} is below minimum ${minimumProfit.toFixed(2)}` };
    }
    
    const items = cart.map(item => {
      const unitPrice = item.customPrice ?? Number(item.variant?.price ?? item.product.price);
      return {
        product_id: item.product.id,
        variant_id: item.variant?.id || null,
        product_name: item.variant?.variation ? `${item.product.name} / ${item.variant.variation}` : item.product.name,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: unitPrice * item.quantity,
      };
    });

    const { data: transaction, error: txError } = await (supabase as any).rpc('create_pos_transaction', {
      p_cashier_id: user.id,
      p_customer_id: selectedCustomer?.id || null,
      p_payment_method: paymentMethod,
      p_subtotal: subtotal,
      p_tax: tax,
      p_discount: discount,
      p_total: total,
      p_loyalty_points_earned: pointsEarned,
      p_loyalty_points_redeemed: loyaltyPointsRedeemed,
      p_items: items,
    });

    if (txError || !transaction) {
      const message = txError?.message || 'Transaction could not be completed.';
      if (message.includes('BILL_PROFIT_TOO_LOW')) {
        const reason = message.replace(/^.*BILL_PROFIT_TOO_LOW:\s*/, '');
        return { blocked: true, reason };
      }
      console.error('POS transaction error:', txError);
      return null;
    }

    clearCart();
    fetchData(); // Refresh data
    
    return transaction;
  }, [user, cart, selectedCustomer, calculateCartTotal, clearCart, fetchData]);

  // Product functions
  const addProduct = useCallback(async (product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'category'>) => {
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();

    if (error) {
      console.error('Add product error:', error);
      return null;
    }
    
    fetchData();
    return data;
  }, [fetchData]);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    const { category, ...dbUpdates } = updates;
    
    const { error } = await supabase
      .from('products')
      .update(dbUpdates)
      .eq('id', id);

    if (error) {
      console.error('Update product error:', error);
      return false;
    }
    
    fetchData();
    return true;
  }, [fetchData]);

  const deleteProduct = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Delete product error:', error);
      return false;
    }
    
    fetchData();
    return true;
  }, [fetchData]);

  // Category functions
  const addCategory = useCallback(async (name: string, description?: string) => {
    const { data, error } = await supabase
      .from('categories')
      .insert({ name, description })
      .select()
      .single();

    if (error) {
      console.error('Add category error:', error);
      return null;
    }
    
    fetchData();
    return data;
  }, [fetchData]);

  // Customer functions
  const addCustomer = useCallback(async (customer: Omit<Customer, 'id' | 'loyalty_points' | 'total_spent' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('customers')
      .insert(customer)
      .select()
      .single();

    if (error) {
      console.error('Add customer error:', error);
      return null;
    }
    
    fetchData();
    return data;
  }, [fetchData]);

  const updateCustomer = useCallback(async (id: string, updates: Partial<Customer>) => {
    const { error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Update customer error:', error);
      return false;
    }
    
    fetchData();
    return true;
  }, [fetchData]);

  // Reorder functions
  const fulfillReorder = useCallback(async (id: string, quantityReceived: number) => {
    const reorder = reorderRequests.find(r => r.id === id);
    if (!reorder) return false;

    // Update product quantity
    const product = products.find(p => p.id === reorder.product_id);
    if (product) {
      await supabase
        .from('products')
        .update({ quantity: product.quantity + quantityReceived })
        .eq('id', product.id);
    }

    // Mark reorder as fulfilled
    const { error } = await supabase
      .from('reorder_requests')
      .update({ status: 'fulfilled', fulfilled_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Fulfill reorder error:', error);
      return false;
    }
    
    fetchData();
    return true;
  }, [reorderRequests, products, fetchData]);

  // Find product by barcode
  const findProductByBarcode = useCallback((barcode: string) => {
    return products.find(p => p.barcode === barcode || p.sku === barcode);
  }, [products]);

  // Metrics
  const getMetrics = useCallback((): DashboardMetrics => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayTransactions = transactions.filter(t => new Date(t.created_at) >= today);
    const todaySales = todayTransactions.reduce((sum, t) => sum + Number(t.total), 0);
    const averageOrderValue = todayTransactions.length > 0 ? todaySales / todayTransactions.length : 0;
    const lowStockItems = products.filter(p => p.quantity <= p.low_stock_threshold).length;
    const totalInventoryValue = products.reduce((sum, p) => sum + Number(p.cost) * p.quantity, 0);
    const pendingReorders = reorderRequests.filter(r => r.status === 'pending').length;

    return {
      todaySales,
      todayTransactions: todayTransactions.length,
      averageOrderValue,
      lowStockItems,
      totalProducts: products.length,
      totalInventoryValue,
      pendingReorders,
    };
  }, [transactions, products, reorderRequests]);

  return {
    products,
    categories,
    transactions,
    customers,
    reorderRequests,
    cart,
    selectedCustomer,
    isLoading,
    setSelectedCustomer,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    updateCartItemPrice,
    clearCart,
    calculateCartTotal,
    processTransaction,
    addProduct,
    updateProduct,
    deleteProduct,
    addCategory,
    addCustomer,
    updateCustomer,
    fulfillReorder,
    findProductByBarcode,
    getMetrics,
    refreshData: fetchData,
  };
}
