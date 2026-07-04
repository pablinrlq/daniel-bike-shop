// _shared/whatsapp.ts — envio de mensagens via Meta WhatsApp Cloud API (Graph v21.0).
//
// Centraliza o POST na Graph API com resultado estruturado (nunca lança por
// resposta não-ok) e resolve o bug clássico do "9º dígito" brasileiro:
// em modo de teste da Meta, o envio só entrega para números da allowed list, e
// o formato cadastrado pode divergir do wa_id que chega no webhook
// (5531982100836 com 9 vs 553182100836 sem 9). Quando o envio falha com o
// code 131030 (recipient not in allowed list), tentamos UMA vez o formato
// alternativo (com/sem o 9) antes de desistir.
//
// Segredos usados (Deno.env): WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID.

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Erro que aparece quando o destinatário não está na allowed list (modo teste).
const ERR_NOT_IN_ALLOWED_LIST = 131030;

export interface GraphResult {
  ok: boolean;
  status: number;
  // JSON parseado da resposta da Graph API (ou o texto cru, se não for JSON).
  data: any;
}

export interface SendResult {
  ok: boolean;
  // Número que de fato funcionou (pode ser o alternativo com/sem o 9º dígito).
  to: string;
  // contacts[0].wa_id da resposta, quando presente (número canônico da Meta).
  waId: string | null;
  errorCode: number | null;
  errorMessage: string | null;
}

export const onlyDigits = (s: string | null | undefined) => (s ?? '').replace(/\D+/g, '');

// Formato alternativo do "9º dígito" BR:
//   55 + DDD + 9XXXXXXXX (13 dígitos, '9' na 5ª posição) -> versão SEM o 9 (12 dígitos)
//   55 + DDD + XXXXXXXX  (12 dígitos)                    -> versão COM o 9 (13 dígitos)
// Qualquer outro formato -> null (não é caso de retry).
export function brAlternate(digits: string): string | null {
  const d = onlyDigits(digits);
  if (!d.startsWith('55')) return null;
  if (d.length === 13 && d[4] === '9') return d.slice(0, 4) + d.slice(5);
  if (d.length === 12) return d.slice(0, 4) + '9' + d.slice(4);
  return null;
}

// POST cru na Graph API. NUNCA lança exception por resposta não-ok (nem por
// falha de rede): sempre retorna { ok, status, data } para o chamador decidir.
export async function callGraph(body: Record<string, unknown>): Promise<GraphResult> {
  const token = Deno.env.get('WHATSAPP_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  if (!token || !phoneNumberId) {
    console.error('Missing WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID');
    return {
      ok: false,
      status: 0,
      data: { error: { code: 0, message: 'WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID não configurados' } },
    };
  }
  try {
    const resp = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
    });
    const raw = await resp.text();
    let data: any = raw;
    try {
      data = JSON.parse(raw);
    } catch {
      // resposta não é JSON — mantém o texto cru em data
    }
    return { ok: resp.ok, status: resp.status, data };
  } catch (e) {
    // Falha de rede/DNS — não derruba o chamador.
    return {
      ok: false,
      status: 0,
      data: { error: { code: 0, message: e instanceof Error ? e.message : String(e) } },
    };
  }
}

// Extrai { code, message } do corpo de erro da Graph API, se houver.
function graphError(result: GraphResult): { code: number | null; message: string | null } {
  const err = result.data && typeof result.data === 'object' ? result.data.error : undefined;
  return {
    code: err?.code ?? null,
    message: err?.message ?? (typeof result.data === 'string' ? result.data : null),
  };
}

function toSendResult(result: GraphResult, to: string): SendResult {
  const err = graphError(result);
  const waId =
    result.data && typeof result.data === 'object'
      ? result.data.contacts?.[0]?.wa_id ?? null
      : null;
  return {
    ok: result.ok,
    to,
    waId,
    errorCode: result.ok ? null : err.code,
    errorMessage: result.ok ? null : err.message,
  };
}

// Envia um payload (text/interactive/template) para 'to'. Se a Meta recusar com
// 131030 (fora da allowed list) e existir o formato BR alternativo (com/sem o
// 9º dígito), tenta UMA vez nesse formato. Retorna o número que funcionou em
// `to` — o chamador pode persistir esse formato como canônico.
export async function sendMessage(to: string, payload: Record<string, unknown>): Promise<SendResult> {
  const first = await callGraph({ to, ...payload });
  if (first.ok) return toSendResult(first, to);

  if (graphError(first).code === ERR_NOT_IN_ALLOWED_LIST) {
    const alt = brAlternate(to);
    if (alt) {
      const second = await callGraph({ to: alt, ...payload });
      if (second.ok) return toSendResult(second, alt);
      return toSendResult(second, to); // reporta o erro da última tentativa
    }
  }
  return toSendResult(first, to);
}

// Envia texto simples, quebrando em pedaços se passar do limite do WhatsApp.
// Retorna o resultado do PRIMEIRO pedaço (é ele que diz se o número entrega).
export async function sendText(
  to: string,
  body: string,
  opts?: { previewUrl?: boolean },
): Promise<SendResult> {
  const previewUrl = opts?.previewUrl ?? true;
  let first: SendResult | null = null;
  let dest = to;
  for (const chunk of splitMessage(body)) {
    const result = await sendMessage(dest, {
      type: 'text',
      text: { body: chunk, preview_url: previewUrl },
    });
    if (!first) first = result;
    if (!result.ok) break; // se um pedaço falhou, não adianta insistir nos próximos
    dest = result.to; // pedaços seguintes já vão no formato que entregou
  }
  return first ?? { ok: false, to, waId: null, errorCode: null, errorMessage: 'texto vazio' };
}

// Marca a mensagem como lida E liga o indicador "digitando..." (a Meta mostra
// por até ~25s ou até a próxima mensagem chegar). Erros são ignorados de
// propósito: isso é cosmético, nunca pode travar o atendimento.
export async function markReadWithTyping(messageId: string): Promise<void> {
  try {
    await callGraph({
      status: 'read',
      message_id: messageId,
      typing_indicator: { type: 'text' },
    });
  } catch {
    // nunca deve acontecer (callGraph não lança), mas por garantia: silêncio.
  }
}

// Dicas de diagnóstico para os erros mais comuns da Graph API.
const ERROR_HINTS: Record<number, string> = {
  131030:
    'número fora da allowed list (modo teste) — tente o formato com/sem o 9º dígito ou cadastre o número no painel da Meta',
  131047: 'janela de 24h fechada — requer template aprovado',
  190: 'WHATSAPP_TOKEN expirado — gere um token permanente',
};

// Log estruturado de falha de envio, com dica de correção quando conhecida.
export function logGraphError(context: string, result: SendResult | GraphResult): void {
  const code = 'errorCode' in result ? result.errorCode : graphError(result).code;
  const message = 'errorMessage' in result ? result.errorMessage : graphError(result).message;
  console.error(`[${context}] Falha no envio WhatsApp`, {
    code,
    message,
    hint: (code != null && ERROR_HINTS[code]) || 'ver https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes',
  });
}

// WhatsApp limita o corpo do texto em 4096 chars. Quebra por parágrafos se precisar.
export function splitMessage(text: string, limit = 3500): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let current = '';
  for (const para of text.split('\n')) {
    if ((current + '\n' + para).length > limit) {
      if (current) chunks.push(current);
      current = para;
    } else {
      current = current ? `${current}\n${para}` : para;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
