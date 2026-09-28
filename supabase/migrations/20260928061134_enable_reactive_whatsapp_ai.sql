-- Reativa somente o atendente reativo: ele responde depois que o cliente chama.
-- O follow-up proativo continua desligado para não iniciar conversas sozinho.

UPDATE public.store_settings
SET
  whatsapp_ai_enabled = true,
  whatsapp_followup_enabled = false,
  updated_at = now();

COMMENT ON COLUMN public.store_settings.whatsapp_ai_enabled IS
  'Quando true, o webhook responde automaticamente às mensagens recebidas.';

COMMENT ON COLUMN public.store_settings.whatsapp_followup_enabled IS
  'Quando true, permite follow-up proativo; mantido false por padrão.';
