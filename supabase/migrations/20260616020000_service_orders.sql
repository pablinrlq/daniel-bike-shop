-- Ordens de serviço (oficina): registrar serviços de manutenção/reparo,
-- acompanhar o status e avisar o cliente no WhatsApp a cada mudança.

-- não começou / em andamento / terminou (+ entregue e cancelado como extras úteis)
CREATE TYPE public.service_status AS ENUM (
  'nao_iniciado',
  'em_andamento',
  'concluido',
  'entregue',
  'cancelado'
);

CREATE TABLE public.service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  equipment TEXT,                 -- ex.: "Caloi Elite 29, aro 29"
  description TEXT,               -- o que será feito / problema relatado
  status public.service_status NOT NULL DEFAULT 'nao_iniciado',
  price NUMERIC(10, 2),
  notes TEXT,
  notify_whatsapp BOOLEAN NOT NULL DEFAULT true,  -- avisar o cliente automaticamente?
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_service_orders_status ON public.service_orders (status, created_at DESC);

-- Admin/editor (equipe da loja) gerenciam tudo. Sem acesso público.
CREATE POLICY "Staff can view service orders"
  ON public.service_orders FOR SELECT
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Staff can insert service orders"
  ON public.service_orders FOR INSERT
  TO authenticated
  WITH CHECK (public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Staff can update service orders"
  ON public.service_orders FOR UPDATE
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Staff can delete service orders"
  ON public.service_orders FOR DELETE
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));

CREATE TRIGGER update_service_orders_updated_at
  BEFORE UPDATE ON public.service_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
