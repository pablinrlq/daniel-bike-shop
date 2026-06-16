-- WhatsApp AI Attendant
-- Memória de conversa por número (para a IA manter contexto entre mensagens) +
-- toggle global do atendente. A edge function `whatsapp-webhook` escreve via
-- service role (bypassa RLS); o painel admin pode ler.

-- ========================
-- Toggle global do atendente de IA (admin pode desligar quando quiser)
-- ========================
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS whatsapp_ai_enabled BOOLEAN NOT NULL DEFAULT true;

-- ========================
-- CONVERSATIONS — uma linha por número de WhatsApp
-- ========================
CREATE TABLE public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL UNIQUE,
  customer_name TEXT,
  -- 'bot' = IA responde automaticamente; 'human' = um atendente assumiu (IA fica em silêncio)
  status TEXT NOT NULL DEFAULT 'bot' CHECK (status IN ('bot', 'human')),
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

-- ========================
-- MESSAGES — histórico de cada conversa
-- ========================
CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  -- id da mensagem na Meta (wamid...) — usado para deduplicar reentregas do webhook.
  -- NULL para mensagens enviadas pela própria IA.
  wa_message_id TEXT UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_whatsapp_messages_conversation
  ON public.whatsapp_messages (conversation_id, created_at);

-- ========================
-- RLS — só admin/editor lê (futuro painel de conversas).
-- A edge function escreve via service role e ignora estas policies.
-- ========================
CREATE POLICY "Admins and editors can view conversations"
  ON public.whatsapp_conversations FOR SELECT
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can update conversations"
  ON public.whatsapp_conversations FOR UPDATE
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));

CREATE POLICY "Admins and editors can view messages"
  ON public.whatsapp_messages FOR SELECT
  TO authenticated
  USING (public.has_admin_or_editor_role(auth.uid()));
