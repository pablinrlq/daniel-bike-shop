-- Phase 2 — Coupon validation server-side
-- 1) Add discount / payment / customer columns to orders
-- 2) Remove public SELECT on discount_coupons (force validation via RPC)
-- 3) RPC validate_coupon(code, subtotal) — pure read, anon-callable
-- 4) RPC consume_coupon(code) — security definer, used by edge functions

-- ============================================================
-- 1) Orders: discount + payment + customer linkage
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_provider TEXT,
  ADD COLUMN IF NOT EXISTS payment_provider_id TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS orders_payment_provider_id_idx ON public.orders(payment_provider_id);

-- ============================================================
-- 2) Lock down direct read of discount_coupons
-- ============================================================

DROP POLICY IF EXISTS "Anyone can view active coupons" ON public.discount_coupons;
-- (admins/editors policy stays — managed in admin UI)

-- ============================================================
-- 3) RPC: validate_coupon (anon-callable, read-only)
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_coupon(
  _code TEXT,
  _subtotal NUMERIC
)
RETURNS TABLE (
  valid BOOLEAN,
  error TEXT,
  code TEXT,
  discount_type TEXT,
  discount_value NUMERIC,
  min_order_value NUMERIC,
  discount_amount NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _coupon public.discount_coupons%ROWTYPE;
  _now TIMESTAMPTZ := now();
  _normalized TEXT := upper(trim(_code));
  _discount NUMERIC := 0;
BEGIN
  IF _normalized IS NULL OR _normalized = '' THEN
    RETURN QUERY SELECT false, 'invalid_code'::TEXT, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  SELECT * INTO _coupon
  FROM public.discount_coupons
  WHERE upper(public.discount_coupons.code) = _normalized
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'not_found'::TEXT, NULL::TEXT, NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  IF _coupon.starts_at IS NOT NULL AND _coupon.starts_at > _now THEN
    RETURN QUERY SELECT false, 'not_started'::TEXT, _coupon.code, _coupon.discount_type, _coupon.discount_value, _coupon.min_order_value, 0::NUMERIC;
    RETURN;
  END IF;

  IF _coupon.expires_at IS NOT NULL AND _coupon.expires_at < _now THEN
    RETURN QUERY SELECT false, 'expired'::TEXT, _coupon.code, _coupon.discount_type, _coupon.discount_value, _coupon.min_order_value, 0::NUMERIC;
    RETURN;
  END IF;

  IF _coupon.max_uses IS NOT NULL AND _coupon.current_uses >= _coupon.max_uses THEN
    RETURN QUERY SELECT false, 'max_uses_reached'::TEXT, _coupon.code, _coupon.discount_type, _coupon.discount_value, _coupon.min_order_value, 0::NUMERIC;
    RETURN;
  END IF;

  IF _coupon.min_order_value IS NOT NULL AND _subtotal < _coupon.min_order_value THEN
    RETURN QUERY SELECT false, 'below_minimum'::TEXT, _coupon.code, _coupon.discount_type, _coupon.discount_value, _coupon.min_order_value, 0::NUMERIC;
    RETURN;
  END IF;

  IF _coupon.discount_type = 'percentage' THEN
    _discount := round((_subtotal * _coupon.discount_value / 100)::numeric, 2);
  ELSE
    _discount := least(_coupon.discount_value, _subtotal);
  END IF;

  RETURN QUERY SELECT true, NULL::TEXT, _coupon.code, _coupon.discount_type, _coupon.discount_value, _coupon.min_order_value, _discount;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_coupon(TEXT, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_coupon(TEXT, NUMERIC) TO anon, authenticated;

-- ============================================================
-- 4) RPC: consume_coupon (server-only, increments current_uses)
-- ============================================================

CREATE OR REPLACE FUNCTION public.consume_coupon(_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated INTEGER;
  _normalized TEXT := upper(trim(_code));
BEGIN
  IF _normalized IS NULL OR _normalized = '' THEN
    RETURN false;
  END IF;

  UPDATE public.discount_coupons
  SET current_uses = current_uses + 1,
      updated_at = now()
  WHERE upper(code) = _normalized
    AND is_active = true
    AND (max_uses IS NULL OR current_uses < max_uses);

  GET DIAGNOSTICS _updated = ROW_COUNT;
  RETURN _updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_coupon(TEXT) FROM PUBLIC;
-- service_role bypasses RLS and has execute by default

-- ============================================================
-- 5) BEFORE INSERT trigger on orders — recompute discount + total
--    Client cannot tamper with the final amount.
-- ============================================================

CREATE OR REPLACE FUNCTION public.orders_recompute_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result RECORD;
BEGIN
  NEW.subtotal := COALESCE(NEW.subtotal, 0);
  NEW.shipping_cost := COALESCE(NEW.shipping_cost, 0);

  IF NEW.coupon_code IS NOT NULL AND length(trim(NEW.coupon_code)) > 0 THEN
    SELECT * INTO _result
    FROM public.validate_coupon(NEW.coupon_code, NEW.subtotal);

    IF _result.valid THEN
      NEW.coupon_code := _result.code;
      NEW.discount_amount := _result.discount_amount;
    ELSE
      -- Invalid coupon at insertion time: discard it (do not block the order).
      NEW.coupon_code := NULL;
      NEW.discount_amount := 0;
    END IF;
  ELSE
    NEW.discount_amount := 0;
  END IF;

  NEW.total := GREATEST(NEW.subtotal - NEW.discount_amount + NEW.shipping_cost, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_recompute_totals_trg ON public.orders;
CREATE TRIGGER orders_recompute_totals_trg
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_recompute_totals();

-- ============================================================
-- 6) AFTER INSERT trigger on orders — consume coupon (idempotent)
-- ============================================================

CREATE OR REPLACE FUNCTION public.orders_consume_coupon()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.coupon_code IS NOT NULL THEN
    PERFORM public.consume_coupon(NEW.coupon_code);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_consume_coupon_trg ON public.orders;
CREATE TRIGGER orders_consume_coupon_trg
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_consume_coupon();
