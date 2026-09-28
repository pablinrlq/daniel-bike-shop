import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, ExternalLink, Loader2, MessageCircle, Send, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { buildPageMessage, buildWhatsappUrl, resolveWhatsappNumber } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';

type ChatRole = 'assistant' | 'user';

interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  isError?: boolean;
}

interface AssistantResponse {
  reply?: string | null;
  handoff?: boolean;
  error?: string;
}

const SESSION_KEY = 'daniel-site-chat-session-v1';
const MESSAGES_KEY = 'daniel-site-chat-messages-v1';
const HIDDEN_ROUTES = ['/login', '/cadastro'];
const STARTER_MESSAGES = [
  'Quais bicicletas vocês têm?',
  'Qual é o horário da loja?',
  'Quero falar com um vendedor',
];

const welcomeMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Oi! Sou o assistente virtual da Daniel Bike Shop. Posso ajudar com bikes, peças, estoque e dúvidas da loja.',
};

function getSessionId(): string {
  const existing = localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(SESSION_KEY, created);
  return created;
}

function loadMessages(): ChatMessage[] {
  try {
    const stored = localStorage.getItem(MESSAGES_KEY);
    if (!stored) return [welcomeMessage];
    const parsed = JSON.parse(stored) as ChatMessage[];
    return Array.isArray(parsed) && parsed.length ? parsed.slice(-20) : [welcomeMessage];
  } catch {
    return [welcomeMessage];
  }
}

const StoreChat = () => {
  const { pathname, search } = useLocation();
  const { data: settings } = useStoreSettings();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [sending, setSending] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionId = useMemo(getSessionId, []);

  const path = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  const hidden = path.startsWith('/admin') || HIDDEN_ROUTES.includes(path);
  const whatsappUrl = buildWhatsappUrl(
    resolveWhatsappNumber(settings?.whatsapp),
    buildPageMessage(pathname, search),
  );

  useEffect(() => {
    localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages.slice(-20)));
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  if (hidden || settings?.whatsapp_ai_enabled === false) return null;

  const submitMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke<AssistantResponse>('store-assistant', {
        body: {
          channel: 'site',
          sessionId,
          message: trimmed,
          page: `${window.location.pathname}${window.location.search}`,
        },
      });
      if (error) throw error;
      if (!data?.reply) throw new Error(data?.error || 'Resposta vazia.');
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: 'assistant', content: data.reply as string },
      ]);
      if (data.handoff) setHandoff(true);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Não consegui responder agora. Você pode chamar nossa equipe pelo WhatsApp.',
          isError: true,
        },
      ]);
      setHandoff(true);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitMessage(input);
  };

  return (
    <>
      {open ? (
        <section
          role="dialog"
          aria-label="Atendimento virtual da Daniel Bike Shop"
          className={cn(
            'fixed inset-x-3 bottom-20 z-50 flex max-h-[min(620px,calc(100dvh-6rem))] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl',
            'sm:inset-x-auto sm:bottom-24 sm:left-6 sm:h-[560px] sm:w-[390px]',
          )}
        >
          <header className="flex items-center justify-between bg-secondary px-4 py-3 text-secondary-foreground">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
                <Bot className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-semibold leading-tight">Daniel • Assistente virtual</h2>
                <p className="text-xs text-secondary-foreground/70">Produtos e dúvidas da loja</p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-secondary-foreground hover:bg-white/10 hover:text-secondary-foreground"
              onClick={() => setOpen(false)}
              aria-label="Fechar atendimento"
            >
              <X className="h-5 w-5" />
            </Button>
          </header>

          <div
            className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4"
            aria-live="polite"
            aria-busy={sending}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <p
                  className={cn(
                    'max-w-[86%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm shadow-sm',
                    message.role === 'user'
                      ? 'rounded-br-sm bg-primary text-primary-foreground'
                      : 'rounded-bl-sm border bg-card text-card-foreground',
                    message.isError && 'border-destructive/40',
                  )}
                >
                  {message.content}
                </p>
              </div>
            ))}

            {messages.length === 1 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {STARTER_MESSAGES.map((message) => (
                  <button
                    key={message}
                    type="button"
                    className="rounded-full border bg-background px-3 py-1.5 text-left text-xs transition-colors hover:border-primary hover:text-primary"
                    onClick={() => void submitMessage(message)}
                  >
                    {message}
                  </button>
                ))}
              </div>
            ) : null}

            {sending ? (
              <div className="flex justify-start">
                <span className="flex items-center gap-2 rounded-2xl rounded-bl-sm border bg-card px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Pensando…
                </span>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          {handoff ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mx-3 mt-3 flex items-center justify-center gap-2 rounded-md bg-[#25D366] px-3 py-2 text-sm font-medium text-white hover:bg-[#20BA5A]"
            >
              Continuar com um vendedor no WhatsApp <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}

          <form onSubmit={handleSubmit} className="border-t bg-card p-3">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(event) => setInput(event.target.value.slice(0, 1200))}
                placeholder="Digite sua dúvida…"
                maxLength={1200}
                disabled={sending}
                aria-label="Mensagem para o assistente"
              />
              <Button type="submit" size="icon" disabled={sending || !input.trim()} aria-label="Enviar mensagem">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Assistente virtual. Preços e estoque são consultados no catálogo.
            </p>
          </form>
        </section>
      ) : null}

      <Button
        type="button"
        size="lg"
        onClick={() => setOpen((current) => !current)}
        className="fixed bottom-4 left-4 z-50 h-14 rounded-full px-4 shadow-lg transition-transform hover:scale-105 sm:bottom-6 sm:left-6"
        aria-label={open ? 'Fechar atendimento virtual' : 'Abrir atendimento virtual'}
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        <span className="ml-2">Posso ajudar?</span>
      </Button>
    </>
  );
};

export default StoreChat;
