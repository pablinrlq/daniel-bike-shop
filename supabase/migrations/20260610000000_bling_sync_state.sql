-- Singleton com o estado da sincronização com o Bling.
-- A edge function bling-sync-products consulta last_incremental_sync_at
-- pra mandar dataAlteracaoInicial=... pro Bling, baixando só o delta.

CREATE TABLE IF NOT EXISTS public.bling_sync_state (
  id INT PRIMARY KEY DEFAULT 1,
  last_incremental_sync_at TIMESTAMPTZ,
  last_full_sync_at TIMESTAMPTZ,
  last_sync_status TEXT,
  last_sync_synced_count INT DEFAULT 0,
  last_sync_failed_count INT DEFAULT 0,
  last_sync_images_count INT DEFAULT 0,
  last_sync_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT bling_sync_state_singleton CHECK (id = 1)
);

INSERT INTO public.bling_sync_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.bling_sync_state ENABLE ROW LEVEL SECURITY;

-- Leitura pra admins/editores (pra UI mostrar o status)
CREATE POLICY "Admins and editors can read sync state"
  ON public.bling_sync_state
  FOR SELECT
  TO authenticated
  USING (public.has_admin_or_editor_role((select auth.uid())));

-- Escrita só via service_role (edge function); bypassa RLS automaticamente.

CREATE TRIGGER bling_sync_state_updated_at
  BEFORE UPDATE ON public.bling_sync_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
