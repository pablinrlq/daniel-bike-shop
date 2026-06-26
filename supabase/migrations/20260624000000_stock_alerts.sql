-- "Avise-me quando chegar" — cliente deixa o WhatsApp num produto esgotado e é
-- notificado quando o estoque voltar. A função stock-alert-notify (agendada)
-- detecta o produto de volta e dispara a mensagem.

CREATE TABLE public.stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT NOT NULL,
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notified_at TIMESTAMP WITH TIME ZONE,
  -- um mesmo número só pede aviso uma vez por produto
  UNIQUE (product_id, customer_phone)
);

ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;

-- só os pendentes interessam para o disparo
CREATE INDEX idx_stock_alerts_pending ON public.stock_alerts (product_id) WHERE notified = false;

-- Qualquer visitante (anon) pode pedir um aviso.
CREATE POLICY "Anyone can request a stock alert"
  ON public.stock_alerts FOR INSERT
  WITH CHECK (true);

-- Só a equipe vê a lista de avisos.
CREATE POLICY "Staff can view stock alerts"
  ON public.stock_alerts FOR SELECT
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Staff can update stock alerts"
  ON public.stock_alerts FOR UPDATE
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));
