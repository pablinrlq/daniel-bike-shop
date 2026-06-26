// whatsapp-followup — follow-up proativo de vendas.
//
// Roda em agendamento (pg_cron, ver README). Procura conversas de clientes que
// vieram do site, ficaram quietos e não fecharam, e manda UMA mensagem da IA
// reengajando a compra — com jeito de vendedor, sem spam.
//
// Compatível com a Meta: só envia DENTRO da janela de 24h desde a última
// mensagem (texto livre é permitido nesse período). Máx. 2 follow-ups por
// cliente, espaçados.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import Anthropic from 'npm:@anthropic-ai/sdk';

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const CLAUDE_MODEL = Deno.env.get('CLAUDE_MODEL') || 'claude-opus-4-8';

// Parâmetros do follow-up (ajustáveis)
const MAX_FOLLOWUPS = 2; // no máximo 2 cutucadas por cliente
const QUIET_HOURS = 2; // só cutuca depois de 2h de silêncio
const WINDOW_HOURS = 23; // só dentro da janela de 24h da Meta (margem de 1h)
const SPACING_HOURS = 6; // intervalo mínimo entre um follow-up e outro
const BATCH = 25; // máximo de clientes por execução

const FOLLOWUP_PROMPT = `Você é o atendente da Daniel Bike Shop (loja de bikes em Belo Horizonte/MG) fazendo um follow-up no WhatsApp de um cliente que veio do site, demonstrou interesse, mas ainda NÃO fechou a compra. Seu objetivo é, com simpatia e jeito de vendedor experiente, retomar o contato e ajudar o cliente a fechar.

Escreva UMA única mensagem curta (1 a 3 frases), em português do Brasil, natural e calorosa, como uma pessoa de verdade mandaria no WhatsApp:
- Retome o que o cliente estava vendo ou perguntando (use o histórico da conversa).
- Mostre que você lembrou dele e quer ajudar a resolver.
- Faça a compra avançar: tire a última dúvida/objeção e ofereça uma facilidade real (ajuda no pagamento via Pix ou cartão, cálculo do frete, ou retirada na loja em BH).
- Seja gentil, SEM pressão e SEM parecer robô ou spam. NÃO use emojis.
- Não invente preço, estoque ou prazo: use só o que já apareceu na conversa.
- Termine com uma pergunta simples que convide a responder (ex.: "quer que eu já reserve a sua?", "te ajudo a fechar agora?").

Responda SOMENTE com a mensagem para o cliente.`;

interface Convo {
  id: string;
  phone: string;
  customer_name: string | null;
  last_message_at: string;
  follow_up_count: number;
  last_follow_up_at: string | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');

  // Segurança: se FOLLOWUP_SECRET estiver setado, exige o header.
  const secret = Deno.env.get('FOLLOWUP_SECRET');
  if (secret && req.headers.get('x-followup-secret') !== secret) {
    return json({ error: 'unauthorized' }, 401);
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    const TOKEN = Deno.env.get('WHATSAPP_TOKEN');
    const PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

    if (!ANTHROPIC_API_KEY || !TOKEN || !PHONE_ID) {
      return json({ error: 'missing_config', message: 'IA ou WhatsApp não configurados' }, 503);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    // Liga/desliga geral (e IA precisa estar ligada também).
    const { data: settings } = await supabase
      .from('store_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    const aiEnabled = settings?.whatsapp_ai_enabled ?? true;
    const followupEnabled = settings?.whatsapp_followup_enabled ?? true;
    if (!aiEnabled || !followupEnabled) {
      return json({ skipped: 'follow-up desligado' }, 200);
    }

    const nowMs = Date.now();
    const windowStart = new Date(nowMs - WINDOW_HOURS * 3600_000).toISOString(); // dentro da janela 24h
    const quietBefore = new Date(nowMs - QUIET_HOURS * 3600_000).toISOString(); // quieto há >= 2h
    const spacingBefore = new Date(nowMs - SPACING_HOURS * 3600_000).toISOString();

    // Candidatos: bot ativo, não encerrados, ainda na janela, quietos, e que
    // ainda não receberam o máximo de follow-ups.
    const { data: candidates, error } = await supabase
      .from('whatsapp_conversations')
      .select('id, phone, customer_name, last_message_at, follow_up_count, last_follow_up_at')
      .eq('status', 'bot')
      .eq('closed', false)
      .lt('follow_up_count', MAX_FOLLOWUPS)
      .gt('last_message_at', windowStart)
      .lt('last_message_at', quietBefore)
      .order('last_message_at', { ascending: true })
      .limit(BATCH);

    if (error) throw error;

    let sent = 0;
    let skipped = 0;

    for (const convo of (candidates ?? []) as Convo[]) {
      try {
        // Respeita o espaçamento entre follow-ups.
        if (convo.last_follow_up_at && convo.last_follow_up_at > spacingBefore) {
          skipped++;
          continue;
        }

        // Pega o histórico recente e confirma que QUEM falou por último foi a loja
        // (cliente ficou sem responder) — é o caso de reengajar.
        const { data: msgs } = await supabase
          .from('whatsapp_messages')
          .select('role, content, created_at')
          .eq('conversation_id', convo.id)
          .order('created_at', { ascending: true })
          .limit(14);

        const history = (msgs ?? []) as { role: string; content: string }[];
        if (history.length === 0 || history[history.length - 1].role !== 'assistant') {
          skipped++;
          continue;
        }

        const n = convo.follow_up_count + 1;
        const isLast = n >= MAX_FOLLOWUPS;
        const transcript = history
          .map((m) => `${m.role === 'user' ? 'Cliente' : 'Loja'}: ${m.content}`)
          .join('\n');
        const userContent =
          `Histórico da conversa com o cliente (veio do site e não fechou):\n\n${transcript}\n\n---\n` +
          `Escreva agora a mensagem de follow-up número ${n}` +
          (isLast ? ' (este é o ÚLTIMO — seja mais leve, ofereça ajuda sem insistir).' : '.') +
          ' Responda só com a mensagem.';

        const resp: any = await anthropic.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 400,
          system: [{ type: 'text', text: FOLLOWUP_PROMPT, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: userContent }],
        });

        const text = (resp.content || [])
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join('\n')
          .trim();
        if (!text) {
          skipped++;
          continue;
        }

        const ok = await sendText(TOKEN, PHONE_ID, convo.phone, text);
        if (!ok) {
          // Provável janela de 24h fechada — encerra pra não tentar de novo.
          await supabase.from('whatsapp_conversations').update({ closed: true }).eq('id', convo.id);
          skipped++;
          continue;
        }

        // Registra a mensagem e atualiza o estado de follow-up.
        // (NÃO mexe em last_message_at: a janela de 24h conta a última msg do cliente.)
        await supabase.from('whatsapp_messages').insert({
          conversation_id: convo.id,
          role: 'assistant',
          content: text,
          wa_message_id: null,
        });
        await supabase
          .from('whatsapp_conversations')
          .update({ follow_up_count: n, last_follow_up_at: new Date().toISOString() })
          .eq('id', convo.id);

        sent++;
      } catch (e) {
        console.error('follow-up convo error', convo.id, e);
        skipped++;
      }
    }

    return json({ ok: true, sent, skipped, candidates: candidates?.length ?? 0 }, 200);
  } catch (e) {
    console.error('whatsapp-followup error:', e);
    return json({ error: 'server_error', message: e instanceof Error ? e.message : 'erro' }, 500);
  }
});

async function sendText(token: string, phoneId: string, to: string, body: string): Promise<boolean> {
  const resp = await fetch(`${GRAPH_BASE}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
  });
  if (!resp.ok) {
    console.error('follow-up send failed:', resp.status, await resp.text());
    return false;
  }
  return true;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
