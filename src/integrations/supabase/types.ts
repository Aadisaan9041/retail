export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          loyalty_points: number | null
          name: string
          phone: string | null
          total_spent: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          loyalty_points?: number | null
          name: string
          phone?: string | null
          total_spent?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          loyalty_points?: number | null
          name?: string
          phone?: string | null
          total_spent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      delivery_partners: {
        Row: {
          api_endpoint: string | null
          api_key: string | null
          created_at: string
          delivery_fee: number | null
          email: string | null
          estimated_delivery_time: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          min_order_value: number | null
          name: string
          phone: string
          service_areas: string[] | null
          updated_at: string
        }
        Insert: {
          api_endpoint?: string | null
          api_key?: string | null
          created_at?: string
          delivery_fee?: number | null
          email?: string | null
          estimated_delivery_time?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          min_order_value?: number | null
          name: string
          phone: string
          service_areas?: string[] | null
          updated_at?: string
        }
        Update: {
          api_endpoint?: string | null
          api_key?: string | null
          created_at?: string
          delivery_fee?: number | null
          email?: string | null
          estimated_delivery_time?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          min_order_value?: number | null
          name?: string
          phone?: string
          service_areas?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_points_history: {
        Row: {
          created_at: string
          customer_id: string
          description: string | null
          id: string
          points: number
          transaction_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          description?: string | null
          id?: string
          points: number
          transaction_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          description?: string | null
          id?: string
          points?: number
          transaction_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_points_history_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_points_history_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_tiers: {
        Row: {
          benefits: string[] | null
          color: string | null
          created_at: string
          discount_percentage: number
          id: string
          min_points: number
          name: string
        }
        Insert: {
          benefits?: string[] | null
          color?: string | null
          created_at?: string
          discount_percentage?: number
          id?: string
          min_points?: number
          name: string
        }
        Update: {
          benefits?: string[] | null
          color?: string | null
          created_at?: string
          discount_percentage?: number
          id?: string
          min_points?: number
          name?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          created_at: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_address: string | null
          delivery_fee: number | null
          delivery_partner_id: string | null
          delivery_pincode: string | null
          estimated_delivery: string | null
          id: string
          status: string | null
          status_history: Json | null
          tracking_number: string | null
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_partner_id?: string | null
          delivery_pincode?: string | null
          estimated_delivery?: string | null
          id?: string
          status?: string | null
          status_history?: Json | null
          tracking_number?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_fee?: number | null
          delivery_partner_id?: string | null
          delivery_pincode?: string | null
          estimated_delivery?: string | null
          id?: string
          status?: string | null
          status_history?: Json | null
          tracking_number?: string | null
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_delivery_partner_id_fkey"
            columns: ["delivery_partner_id"]
            isOneToOne: false
            referencedRelation: "delivery_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_delivery_partner_id_fkey"
            columns: ["delivery_partner_id"]
            isOneToOne: false
            referencedRelation: "delivery_partners_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      price_override_logs: {
        Row: {
          created_at: string
          id: string
          modified_price: number
          original_price: number
          product_id: string | null
          product_name: string
          reason: string | null
          transaction_id: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          modified_price: number
          original_price: number
          product_id?: string | null
          product_name: string
          reason?: string | null
          transaction_id?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          modified_price?: number
          original_price?: number
          product_id?: string | null
          product_name?: string
          reason?: string | null
          transaction_id?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_override_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_override_logs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          chest_size: string | null
          color: string | null
          cost: number
          created_at: string
          id: string
          image_url: string | null
          length_size: string | null
          meesho_price: number | null
          mrp: number
          price: number
          product_id: string | null
          quantity: number
          shoulder_size: string | null
          sku: string
          updated_at: string
          variation: string
          wrong_defective_price: number | null
        }
        Insert: {
          barcode?: string | null
          chest_size?: string | null
          color?: string | null
          cost?: number
          created_at?: string
          id?: string
          image_url?: string | null
          length_size?: string | null
          meesho_price?: number | null
          mrp?: number
          price?: number
          product_id?: string | null
          quantity?: number
          shoulder_size?: string | null
          sku: string
          updated_at?: string
          variation: string
          wrong_defective_price?: number | null
        }
        Update: {
          barcode?: string | null
          chest_size?: string | null
          color?: string | null
          cost?: number
          created_at?: string
          id?: string
          image_url?: string | null
          length_size?: string | null
          meesho_price?: number | null
          mrp?: number
          price?: number
          product_id?: string | null
          quantity?: number
          shoulder_size?: string | null
          sku?: string
          updated_at?: string
          variation?: string
          wrong_defective_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          auto_reorder: boolean | null
          barcode: string | null
          brand: string | null
          category_id: string | null
          character_theme: string | null
          chest_size: string | null
          color: string | null
          cost: number
          country_of_origin: string | null
          created_at: string
          description: string | null
          ean_upc: string | null
          fabric: string | null
          fit_shape: string | null
          generic_name: string | null
          group_id: string | null
          hemline: string | null
          id: string
          image_url: string | null
          image_url_2: string | null
          image_url_3: string | null
          image_url_4: string | null
          importer_address: string | null
          importer_name: string | null
          importer_pincode: string | null
          length_size: string | null
          length_type: string | null
          low_stock_threshold: number
          manufacturer_address: string | null
          manufacturer_name: string | null
          manufacturer_pincode: string | null
          mrp: number | null
          name: string
          neck_type: string | null
          net_quantity: number | null
          net_weight_grams: number | null
          number_of_pockets: number | null
          occasion: string | null
          packer_address: string | null
          packer_name: string | null
          packer_pincode: string | null
          pattern: string | null
          price: number
          print_pattern_type: string | null
          quantity: number
          reorder_quantity: number | null
          shoulder_size: string | null
          sku: string
          sleeve_length: string | null
          sleeve_styling: string | null
          style_id: string | null
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          auto_reorder?: boolean | null
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          character_theme?: string | null
          chest_size?: string | null
          color?: string | null
          cost?: number
          country_of_origin?: string | null
          created_at?: string
          description?: string | null
          ean_upc?: string | null
          fabric?: string | null
          fit_shape?: string | null
          generic_name?: string | null
          group_id?: string | null
          hemline?: string | null
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          image_url_4?: string | null
          importer_address?: string | null
          importer_name?: string | null
          importer_pincode?: string | null
          length_size?: string | null
          length_type?: string | null
          low_stock_threshold?: number
          manufacturer_address?: string | null
          manufacturer_name?: string | null
          manufacturer_pincode?: string | null
          mrp?: number | null
          name: string
          neck_type?: string | null
          net_quantity?: number | null
          net_weight_grams?: number | null
          number_of_pockets?: number | null
          occasion?: string | null
          packer_address?: string | null
          packer_name?: string | null
          packer_pincode?: string | null
          pattern?: string | null
          price?: number
          print_pattern_type?: string | null
          quantity?: number
          reorder_quantity?: number | null
          shoulder_size?: string | null
          sku: string
          sleeve_length?: string | null
          sleeve_styling?: string | null
          style_id?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          auto_reorder?: boolean | null
          barcode?: string | null
          brand?: string | null
          category_id?: string | null
          character_theme?: string | null
          chest_size?: string | null
          color?: string | null
          cost?: number
          country_of_origin?: string | null
          created_at?: string
          description?: string | null
          ean_upc?: string | null
          fabric?: string | null
          fit_shape?: string | null
          generic_name?: string | null
          group_id?: string | null
          hemline?: string | null
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          image_url_4?: string | null
          importer_address?: string | null
          importer_name?: string | null
          importer_pincode?: string | null
          length_size?: string | null
          length_type?: string | null
          low_stock_threshold?: number
          manufacturer_address?: string | null
          manufacturer_name?: string | null
          manufacturer_pincode?: string | null
          mrp?: number | null
          name?: string
          neck_type?: string | null
          net_quantity?: number | null
          net_weight_grams?: number | null
          number_of_pockets?: number | null
          occasion?: string | null
          packer_address?: string | null
          packer_name?: string | null
          packer_pincode?: string | null
          pattern?: string | null
          price?: number
          print_pattern_type?: string | null
          quantity?: number
          reorder_quantity?: number | null
          shoulder_size?: string | null
          sku?: string
          sleeve_length?: string | null
          sleeve_styling?: string | null
          style_id?: string | null
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reorder_requests: {
        Row: {
          created_at: string
          fulfilled_at: string | null
          id: string
          product_id: string
          quantity: number
          status: string | null
        }
        Insert: {
          created_at?: string
          fulfilled_at?: string | null
          id?: string
          product_id: string
          quantity: number
          status?: string | null
        }
        Update: {
          created_at?: string
          fulfilled_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reorder_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          gst_number: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transaction_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          variant_id: string | null
          product_name: string
          quantity: number
          total_price: number
          transaction_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          variant_id?: string | null
          product_name: string
          quantity: number
          total_price: number
          transaction_id: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          variant_id?: string | null
          product_name?: string
          quantity?: number
          total_price?: number
          transaction_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          cashier_id: string | null
          created_at: string
          customer_id: string | null
          discount: number | null
          id: string
          loyalty_points_earned: number | null
          loyalty_points_redeemed: number | null
          payment_method: string
          status: string | null
          subtotal: number
          tax: number
          total: number
        }
        Insert: {
          cashier_id?: string | null
          created_at?: string
          customer_id?: string | null
          discount?: number | null
          id?: string
          loyalty_points_earned?: number | null
          loyalty_points_redeemed?: number | null
          payment_method?: string
          status?: string | null
          subtotal?: number
          tax?: number
          total?: number
        }
        Update: {
          cashier_id?: string | null
          created_at?: string
          customer_id?: string | null
          discount?: number | null
          id?: string
          loyalty_points_earned?: number | null
          loyalty_points_redeemed?: number | null
          payment_method?: string
          status?: string | null
          subtotal?: number
          tax?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      upi_payment_verifications: {
        Row: {
          amount: number
          created_at: string
          id: string
          merchant_vpa: string
          order_id: string | null
          payer_vpa: string | null
          status: string
          transaction_ref: string
          updated_at: string
          utr_number: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          merchant_vpa: string
          order_id?: string | null
          payer_vpa?: string | null
          status?: string
          transaction_ref: string
          updated_at?: string
          utr_number?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          merchant_vpa?: string
          order_id?: string | null
          payer_vpa?: string | null
          status?: string
          transaction_ref?: string
          updated_at?: string
          utr_number?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "upi_payment_verifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      delivery_partners_public: {
        Row: {
          created_at: string | null
          delivery_fee: number | null
          email: string | null
          estimated_delivery_time: string | null
          id: string | null
          is_active: boolean | null
          min_order_value: number | null
          name: string | null
          phone: string | null
          service_areas: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_fee?: number | null
          email?: string | null
          estimated_delivery_time?: string | null
          id?: string | null
          is_active?: boolean | null
          min_order_value?: number | null
          name?: string | null
          phone?: string | null
          service_areas?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_fee?: number | null
          email?: string | null
          estimated_delivery_time?: string | null
          id?: string | null
          is_active?: boolean | null
          min_order_value?: number | null
          name?: string | null
          phone?: string | null
          service_areas?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_user_role: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_any_role: { Args: { _user_id: string }; Returns: boolean }
      is_customer: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "manager" | "cashier" | "customer"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "cashier", "customer"],
    },
  },
} as const
