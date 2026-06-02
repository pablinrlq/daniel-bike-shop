-- Phase 3 — Customer access to their own orders + email fallback

-- Customers can SELECT their own orders (by user_id, set on insert)
-- (select auth.uid()) is the recommended pattern: Postgres caches the
-- function result per query instead of evaluating it per row.
CREATE POLICY "Customers can view their own orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Customers can SELECT items of orders they own
CREATE POLICY "Customers can view their own order items"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND orders.user_id = (select auth.uid())
    )
  );

-- (The "Users can view own profile" SELECT policy already exists from an
-- earlier migration — not recreated here to avoid a "policy exists" error.)

-- Backfill: link existing orders to users when the email matches an auth user
-- (best-effort; safe to re-run)
UPDATE public.orders o
SET user_id = u.id
FROM auth.users u
WHERE o.user_id IS NULL
  AND lower(o.customer_email) = lower(u.email);
