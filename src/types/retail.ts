export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  price: number;
  cost: number;
   mrp?: number;
  quantity: number;
  category_id?: string | null;
  category?: string;
  image_url?: string | null;
   image_url_2?: string | null;
   image_url_3?: string | null;
   image_url_4?: string | null;
  low_stock_threshold: number;
  reorder_quantity?: number | null;
  auto_reorder?: boolean;
  created_at: string;
  updated_at: string;
   // Marketplace fields
   description?: string | null;
   brand?: string | null;
   generic_name?: string | null;
   color?: string | null;
   fabric?: string | null;
   pattern?: string | null;
   fit_shape?: string | null;
   occasion?: string | null;
   sleeve_length?: string | null;
   neck_type?: string | null;
   hemline?: string | null;
   length_type?: string | null;
   sleeve_styling?: string | null;
   print_pattern_type?: string | null;
   character_theme?: string | null;
   number_of_pockets?: number | null;
   net_weight_grams?: number | null;
   net_quantity?: number | null;
   chest_size?: string | null;
   length_size?: string | null;
   shoulder_size?: string | null;
   country_of_origin?: string | null;
   manufacturer_name?: string | null;
   manufacturer_address?: string | null;
   manufacturer_pincode?: string | null;
   packer_name?: string | null;
   packer_address?: string | null;
   packer_pincode?: string | null;
   importer_name?: string | null;
   importer_address?: string | null;
   importer_pincode?: string | null;
   ean_upc?: string | null;
   style_id?: string | null;
   group_id?: string | null;
   supplier_id?: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gst_number?: string | null;
  payment_terms?: string | null;
  is_active?: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
}

export interface CartItem {
  product: Product;
  variant?: import('@/types/marketplace').ProductVariant;
  quantity: number;
  customPrice?: number; // Negotiated transaction price; never changes catalogue price
}

export interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  loyalty_points: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  cashier_id?: string | null;
  customer_id?: string | null;
  customer?: Customer | null;
  items: TransactionItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  payment_method: 'cash' | 'card' | 'other';
  loyalty_points_earned: number;
  loyalty_points_redeemed: number;
  status: string;
  created_at: string;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string;
  variant_id?: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  unit_cost?: number | null;
  created_at: string;
}

export interface ReorderRequest {
  id: string;
  product_id: string;
  product?: Product;
  quantity: number;
  status: string;
  created_at: string;
  fulfilled_at?: string | null;
}

export interface DashboardMetrics {
  todaySales: number;
  todayTransactions: number;
  averageOrderValue: number;
  lowStockItems: number;
  totalProducts: number;
  totalInventoryValue: number;
  pendingReorders: number;
}

export type ViewType = 'dashboard' | 'pos' | 'products' | 'transactions' | 'reports' | 'customers' | 'reorders' | 'loyalty' | 'loyalty-analytics' | 'orders' | 'settings' | 'user-management' | 'ai-recommendations' | 'suppliers';

export type AppRole = 'admin' | 'manager' | 'cashier' | 'customer';

export interface UserProfile {
  id: string;
  user_id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}
