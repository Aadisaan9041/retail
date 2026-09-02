-- Unified visual POS: variant-aware stock, bill-level profit protection, and negotiated prices.
-- Apply after the existing retail migrations.

ALTER TABLE public.transaction_items
  ADD COLUMN IF NOT EXISTS variant_id uuid REFERENCES public.product_variants(id);

CREATE INDEX IF NOT EXISTS idx_transaction_items_variant_id
  ON public.transaction_items(variant_id);

-- Default minimum bill gross profit is zero; owner can change app_settings.value.
INSERT INTO public.app_settings (key, value)
VALUES ('minimum_bill_gross_profit', '0'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Variant-aware inventory deduction. A variant sale decrements the variant only;
-- a non-variant sale decrements the parent product.
CREATE OR REPLACE FUNCTION public.update_inventory_after_transaction_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.variant_id IS NOT NULL THEN
    UPDATE public.product_variants
      SET quantity = quantity - NEW.quantity, updated_at = now()
      WHERE id = NEW.variant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant % not found', NEW.variant_id;
    END IF;
  ELSE
    UPDATE public.products
      SET quantity = quantity - NEW.quantity, updated_at = now()
      WHERE id = NEW.product_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', NEW.product_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_transaction_item_created ON public.transaction_items;
DROP TRIGGER IF EXISTS update_product_quantity_trigger ON public.transaction_items;
CREATE TRIGGER update_product_quantity_trigger
AFTER INSERT ON public.transaction_items
FOR EACH ROW EXECUTE FUNCTION public.update_inventory_after_transaction_item();

-- Do not award loyalty until a transaction is actually completed.
CREATE OR REPLACE FUNCTION public.update_customer_loyalty()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') AND NEW.customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET loyalty_points = loyalty_points + NEW.loyalty_points_earned - NEW.loyalty_points_redeemed,
        total_spent = total_spent + NEW.total,
        updated_at = now()
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_transaction_created ON public.transactions;
DROP TRIGGER IF EXISTS update_customer_loyalty_trigger ON public.transactions;
CREATE TRIGGER update_customer_loyalty_trigger
AFTER INSERT OR UPDATE OF status ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.update_customer_loyalty();

-- Deferred validation runs at COMMIT, after every transaction item has been inserted.
-- This permits one item to be below cost as long as the complete bill remains profitable.
CREATE OR REPLACE FUNCTION public.validate_completed_pos_bill_profit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  tx RECORD;
  bill_cost numeric := 0;
  bill_revenue numeric := 0;
  minimum_profit numeric := 0;
BEGIN
  SELECT * INTO tx FROM public.transactions WHERE id = NEW.transaction_id;
  IF tx.status <> 'completed' THEN RETURN NEW; END IF;

  SELECT CASE
    WHEN jsonb_typeof(value) = 'object' AND value ? 'amount' THEN (value->>'amount')::numeric
    WHEN jsonb_typeof(value) = 'number' THEN value::text::numeric
    ELSE 0
  END
    INTO minimum_profit
    FROM public.app_settings
    WHERE key = 'minimum_bill_gross_profit';
  minimum_profit := COALESCE(minimum_profit, 0);

  SELECT COALESCE(SUM(ti.total_price),0),
         COALESCE(SUM(ti.quantity * COALESCE(ti.unit_cost, pv.cost, p.cost)),0)
    INTO bill_revenue, bill_cost
    FROM public.transaction_items ti
    JOIN public.products p ON p.id = ti.product_id
    LEFT JOIN public.product_variants pv ON pv.id = ti.variant_id
    WHERE ti.transaction_id = NEW.transaction_id;

  IF (bill_revenue - COALESCE(tx.discount,0) - bill_cost) < minimum_profit THEN
    RAISE EXCEPTION 'BILL_PROFIT_TOO_LOW: gross profit % is below minimum %',
      ROUND(bill_revenue - COALESCE(tx.discount,0) - bill_cost, 2), ROUND(minimum_profit, 2);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_completed_pos_bill_profit ON public.transaction_items;
CREATE CONSTRAINT TRIGGER validate_completed_pos_bill_profit
AFTER INSERT OR UPDATE ON public.transaction_items
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.validate_completed_pos_bill_profit();


-- Atomic POS transaction API. The client sends the already-confirmed negotiated
-- item prices; this function performs the authoritative stock and profit checks
-- and commits the transaction + items together.
CREATE OR REPLACE FUNCTION public.create_pos_transaction(
  p_cashier_id uuid,
  p_customer_id uuid,
  p_payment_method text,
  p_subtotal numeric,
  p_tax numeric,
  p_discount numeric,
  p_total numeric,
  p_loyalty_points_earned integer,
  p_loyalty_points_redeemed integer,
  p_items jsonb
)
RETURNS public.transactions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item jsonb;
  v_product_id uuid;
  v_variant_id uuid;
  v_quantity integer;
  v_unit_price numeric;
  v_cost numeric;
  v_bill_cost numeric := 0;
  v_bill_revenue numeric := 0;
  v_min_profit numeric := 0;
  v_tx public.transactions;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_cashier_id OR NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'POS_UNAUTHORIZED';
  END IF;

  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'POS_EMPTY_BILL';
  END IF;

  SELECT CASE
    WHEN jsonb_typeof(value) = 'object' AND value ? 'amount' THEN (value->>'amount')::numeric
    WHEN jsonb_typeof(value) = 'number' THEN value::text::numeric
    ELSE 0
  END INTO v_min_profit
  FROM public.app_settings WHERE key = 'minimum_bill_gross_profit';
  v_min_profit := COALESCE(v_min_profit, 0);

  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (item->>'product_id')::uuid;
    v_variant_id := NULLIF(item->>'variant_id','')::uuid;
    v_quantity := (item->>'quantity')::integer;
    v_unit_price := (item->>'unit_price')::numeric;

    IF v_quantity <= 0 OR v_unit_price < 0 THEN
      RAISE EXCEPTION 'POS_INVALID_ITEM';
    END IF;

    IF v_variant_id IS NOT NULL THEN
      SELECT cost INTO v_cost FROM public.product_variants WHERE id = v_variant_id AND product_id = v_product_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'POS_VARIANT_NOT_FOUND'; END IF;
      IF (SELECT quantity FROM public.product_variants WHERE id = v_variant_id) < v_quantity THEN
        RAISE EXCEPTION 'POS_INSUFFICIENT_STOCK';
      END IF;
    ELSE
      SELECT cost INTO v_cost FROM public.products WHERE id = v_product_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'POS_PRODUCT_NOT_FOUND'; END IF;
      IF (SELECT quantity FROM public.products WHERE id = v_product_id) < v_quantity THEN
        RAISE EXCEPTION 'POS_INSUFFICIENT_STOCK';
      END IF;
    END IF;

    v_bill_cost := v_bill_cost + v_cost * v_quantity;
    v_bill_revenue := v_bill_revenue + v_unit_price * v_quantity;
  END LOOP;

  IF ABS(v_bill_revenue - COALESCE(p_subtotal,0)) > 0.01 THEN
    RAISE EXCEPTION 'POS_TOTAL_MISMATCH';
  END IF;

  IF (v_bill_revenue - COALESCE(p_discount,0) - v_bill_cost) < v_min_profit THEN
    RAISE EXCEPTION 'BILL_PROFIT_TOO_LOW: gross profit % is below minimum %',
      ROUND(v_bill_revenue - COALESCE(p_discount,0) - v_bill_cost, 2), ROUND(v_min_profit, 2);
  END IF;

  IF ABS((v_bill_revenue - COALESCE(p_discount,0) + COALESCE(p_tax,0)) - COALESCE(p_total,0)) > 0.01 THEN
    RAISE EXCEPTION 'POS_TOTAL_MISMATCH';
  END IF;

  INSERT INTO public.transactions (
    cashier_id, customer_id, subtotal, tax, discount, total,
    payment_method, loyalty_points_earned, loyalty_points_redeemed, status
  ) VALUES (
    p_cashier_id, p_customer_id, p_subtotal, p_tax, p_discount, p_total,
    p_payment_method, p_loyalty_points_earned, p_loyalty_points_redeemed, 'completed'
  ) RETURNING * INTO v_tx;

  FOR item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.transaction_items (
      transaction_id, product_id, variant_id, product_name, quantity, unit_price, total_price
    ) VALUES (
      v_tx.id,
      (item->>'product_id')::uuid,
      NULLIF(item->>'variant_id','')::uuid,
      item->>'product_name',
      (item->>'quantity')::integer,
      (item->>'unit_price')::numeric,
      (item->>'total_price')::numeric
    );
  END LOOP;

  RETURN v_tx;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pos_transaction(uuid,uuid,text,numeric,numeric,numeric,numeric,integer,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pos_transaction(uuid,uuid,text,numeric,numeric,numeric,numeric,integer,integer,jsonb) TO authenticated;
