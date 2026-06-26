-- Follow-up proativo do WhatsApp.
-- A IA reengaja clientes que vieram do site, demonstraram interesse e não
-- fecharam — SEMPRE dentro da janela de 24h da Meta (mensagem livre só é
-- permitida nesse período; fora disso exigiria template aprovado).

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS follow_up_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_follow_up_at TIMESTAMP WITH TIME ZONE,
  -- encerrada (comprou / pediu pra parar / equipe fechou) -> não recebe follow-up
  ADD COLUMN IF NOT EXISTS closed BOOLEAN NOT NULL DEFAULT false;

-- Liga/desliga geral do follow-up proativo (admin controla na aba Atendente IA).
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS whatsapp_followup_enabled BOOLEAN NOT NULL DEFAULT true;
