-- Preserve the exact inventory cost at the moment of sale so historical profit
-- remains correct even when catalogue costs are changed later.
ALTER TABLE public.transaction_items
  ADD COLUMN IF NOT EXISTS unit_cost numeric(10,2);

CREATE INDEX IF NOT EXISTS idx_transaction_items_product_variant
  ON public.transaction_items(product_id, variant_id);

-- Rebuild the authoritative POS RPC so every sale snapshots its unit cost.
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
  END
  INTO v_min_profit
  FROM public.app_settings
  WHERE key = 'minimum_bill_gross_profit';
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
      SELECT cost, quantity INTO v_cost, v_quantity
      FROM public.product_variants
      WHERE id = v_variant_id AND product_id = v_product_id
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'POS_VARIANT_NOT_FOUND'; END IF;
      IF v_quantity < (item->>'quantity')::integer THEN RAISE EXCEPTION 'POS_INSUFFICIENT_STOCK'; END IF;
      v_quantity := (item->>'quantity')::integer;
    ELSE
      SELECT cost, quantity INTO v_cost, v_quantity
      FROM public.products
      WHERE id = v_product_id
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'POS_PRODUCT_NOT_FOUND'; END IF;
      IF v_quantity < (item->>'quantity')::integer THEN RAISE EXCEPTION 'POS_INSUFFICIENT_STOCK'; END IF;
      v_quantity := (item->>'quantity')::integer;
    END IF;

    v_bill_cost := v_bill_cost + COALESCE(v_cost, 0) * v_quantity;
    v_bill_revenue := v_bill_revenue + v_unit_price * v_quantity;
  END LOOP;

  IF ABS(v_bill_revenue - COALESCE(p_subtotal,0)) > 0.01 THEN
    RAISE EXCEPTION 'POS_TOTAL_MISMATCH';
  END IF;

  IF (v_bill_revenue - COALESCE(p_discount,0) - v_bill_cost) < v_min_profit THEN
    RAISE EXCEPTION 'BILL_PROFIT_TOO_LOW: gross profit % is below minimum %',
      ROUND(v_bill_revenue - COALESCE(p_discount,0) - v_bill_cost, 2),
      ROUND(v_min_profit, 2);
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
    v_product_id := (item->>'product_id')::uuid;
    v_variant_id := NULLIF(item->>'variant_id','')::uuid;
    IF v_variant_id IS NOT NULL THEN
      SELECT cost INTO v_cost FROM public.product_variants WHERE id = v_variant_id AND product_id = v_product_id;
    ELSE
      SELECT cost INTO v_cost FROM public.products WHERE id = v_product_id;
    END IF;

    INSERT INTO public.transaction_items (
      transaction_id, product_id, variant_id, product_name, quantity,
      unit_price, total_price, unit_cost
    ) VALUES (
      v_tx.id,
      v_product_id,
      v_variant_id,
      item->>'product_name',
      (item->>'quantity')::integer,
      (item->>'unit_price')::numeric,
      (item->>'total_price')::numeric,
      COALESCE(v_cost, 0)
    );
  END LOOP;

  RETURN v_tx;
END;
$$;

REVOKE ALL ON FUNCTION public.create_pos_transaction(uuid,uuid,text,numeric,numeric,numeric,numeric,integer,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_pos_transaction(uuid,uuid,text,numeric,numeric,numeric,numeric,integer,integer,jsonb) TO authenticated;
