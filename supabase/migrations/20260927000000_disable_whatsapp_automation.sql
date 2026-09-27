-- A loja usa o WhatsApp como canal de conversão humana (click-to-chat).
-- Desativa o atendente automático e o follow-up proativo em instalações
-- existentes e também muda os defaults para instalações/configurações futuras.

ALTER TABLE public.store_settings
  ALTER COLUMN whatsapp_ai_enabled SET DEFAULT false,
  ALTER COLUMN whatsapp_followup_enabled SET DEFAULT false;

UPDATE public.store_settings
SET
  whatsapp_ai_enabled = false,
  whatsapp_followup_enabled = false;

COMMENT ON COLUMN public.store_settings.whatsapp_ai_enabled IS
  'Legado: deve permanecer false; o WhatsApp é atendido por vendedores.';

COMMENT ON COLUMN public.store_settings.whatsapp_followup_enabled IS
  'Legado: deve permanecer false; não enviar follow-up automático.';
