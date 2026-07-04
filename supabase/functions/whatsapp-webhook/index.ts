// WhatsApp AI Attendant — Daniel Bike Shop
//
// Recebe mensagens do WhatsApp (Meta Cloud API), responde com a Claude API de
// forma autônoma e consulta preços/estoque reais no Supabase (catálogo vindo do
// Bling). Mantém memória de conversa por número e sabe transferir para um humano.
//
// Fluxo:
//   GET  -> handshake de verificação do webhook da Meta (hub.challenge)
//   POST -> recebe mensagens; responde 200 na hora e processa em background
//           (a Meta exige resposta rápida, senão reenvia o evento).
//
// Segredos necessários (supabase secrets set ...): ver README.md desta função.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import Anthropic from 'npm:@anthropic-ai/sdk';
// Envio via Meta Cloud API com retry do "9º dígito" BR e log estruturado de erro.
import {
  sendText,
  sendMessage,
  markReadWithTyping,
  logGraphError,
  type SendResult,
} from '../_shared/whatsapp.ts';

// ---- Config ----
// Modelo: padrão Haiku 4.5 — rápido e barato, ideal pra atendimento no WhatsApp.
// Para respostas ainda mais espertas, troque por "claude-sonnet-4-6" (equilíbrio)
// ou "claude-opus-4-8" (mais capaz) só mudando o secret CLAUDE_MODEL. Ver README.
const CLAUDE_MODEL = Deno.env.get('CLAUDE_MODEL') || 'claude-haiku-4-5';
const SITE_URL = (Deno.env.get('PUBLIC_SITE_URL') || 'https://danielbikeshop.com').replace(/\/$/, '');
const HISTORY_LIMIT = 20; // mensagens de contexto por conversa
const MAX_TOOL_STEPS = 5; // trava de segurança no loop de ferramentas

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v) || 0);

// Fatos que NÃO estão no banco (pagamento/frete). Edite aqui quando a política mudar.
const STORE_FACTS = `Formas de pagamento: Pix e cartão de crédito/débito pelo site (Mercado Pago), ou combinar pelo WhatsApp.
Frete: calculado no checkout do site. Política atual: frete grátis acima de R$ 299; abaixo disso, taxa fixa de R$ 29,90.
Retirada: dá para combinar retirada na loja em Belo Horizonte/MG.
Site da loja: ${SITE_URL}`;

const SYSTEM_PROMPT = `Você é o Daniel, atendente e vendedor da Daniel Bike Shop, uma loja de bicicletas, peças, acessórios e oficina (serviços) em Belo Horizonte/MG. Você atende os clientes pelo WhatsApp.

PERSONALIDADE E TOM
- Você é o Daniel: simpático e acolhedor, mas profissional e objetivo. Trate o cliente por "você".
- Mensagem de WhatsApp é curta — nada de textão. Vá direto ao ponto, frases curtas. Faça UMA pergunta por vez.
- Use emojis com muita moderação (no máximo um por mensagem, e nem sempre). Use *negrito* só para nome de produto ou preço.
- Se perguntarem seu nome, você é o Daniel.

PRIMEIRO CONTATO
- Uma mensagem de boas-vindas automática (sua apresentação + link do site + endereço/horário + opção de falar com um vendedor) JÁ FOI enviada ao cliente. NÃO repita essa saudação nem essas informações.
- Se a primeira mensagem do cliente for só um "oi" ou "quero informações", responda em uma linha perguntando, de forma simpática, o que ele procura. Se ele já disse o que quer, vá direto ajudar.

COMO ATENDER (igual a um bom vendedor)
- Entenda a necessidade antes de empurrar produto: pergunte o uso (cidade, trilha, estrada, trabalho), a faixa de preço e, para bikes, a altura/tamanho de quadro se fizer sentido.
- Recomende 1 a 3 opções que encaixam, explicando rápido por que cada uma serve. Não jogue uma lista gigante.
- Faça sugestões complementares quando couber (capacete, cadeado, bomba, kit de manutenção) — sem ser chato.
- Se o cliente está em dúvida entre dois produtos, ajude a comparar de forma simples.

REGRAS DE OURO (não pode errar)
- NUNCA invente preço, estoque, prazo ou informação da loja. SEMPRE use as ferramentas para consultar dados reais antes de falar de produto, preço ou disponibilidade.
- Use "buscar_produtos" para procurar e "detalhes_produto" para aprofundar. Se não achar, diga com franqueza e ofereça alternativas próximas.
- Sempre que citar um produto, mande o link dele.
- Para fechar a compra, oriente a finalizar pelo site (mande o link) ou ofereça chamar um atendente humano para combinar.
- Use "info_loja" para dúvidas de endereço, horário, pagamento e frete.

SERVIÇOS / OFICINA
- A loja faz manutenção e reparo (revisão, freio, câmbio, troca de peças, montagem). Se o cliente quiser um serviço, explique que é só trazer/relatar o que precisa; um atendente registra a ordem de serviço e ele recebe as atualizações de status aqui pelo WhatsApp.
- Para agendar ou registrar um serviço, ou para saber orçamento de mão de obra, use "escalar_humano" (a equipe cadastra o serviço no sistema).

PEDIDOS E PÓS-VENDA
- Você não acessa o status de pedidos individuais. Se perguntarem "cadê meu pedido", peça o número do pedido e use "escalar_humano" para um atendente verificar.

QUANDO CHAMAR UM HUMANO ("escalar_humano")
- Cliente pede para falar com uma pessoa; quer negociar desconto fora do site; reclamação séria; registrar/agendar serviço; status de pedido; ou qualquer coisa que você não resolva. Depois de escalar, avise o cliente com simpatia que um atendente vai assumir.

TRANSPARÊNCIA
- Se perguntarem se você é um robô/IA, pode dizer com naturalidade que é o assistente virtual da loja e que chama um humano quando precisa.

Informações fixas da loja:
${STORE_FACTS}

Responda SEMPRE apenas com a mensagem final para o cliente, em português do Brasil. Não explique seu raciocínio nem diga quais ferramentas usou.`;

// ---- Ferramentas que a IA pode chamar ----
const TOOLS = [
  {
    name: 'buscar_produtos',
    description:
      'Busca produtos no catálogo da loja por nome, marca ou tipo. Use SEMPRE que o cliente perguntar sobre produtos, preços, disponibilidade ou quiser recomendações. Retorna nome, preço, estoque e link.',
    input_schema: {
      type: 'object',
      properties: {
        termo: {
          type: 'string',
          description:
            "O que procurar: nome, marca ou tipo. Ex: 'mountain bike aro 29', 'capacete', 'câmbio shimano'.",
        },
        categoria: {
          type: 'string',
          description: 'Opcional. Filtra por categoria: bicicletas, pecas ou acessorios.',
        },
      },
      required: ['termo'],
    },
  },
  {
    name: 'detalhes_produto',
    description:
      'Detalhes completos de um produto específico (descrição, especificações como aro, material do quadro, marchas, suspensão, estoque, preço e link). Use depois que a busca já identificou o produto.',
    input_schema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'slug do produto (retornado pela busca)' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'info_loja',
    description:
      'Informações da loja: endereço, horário de funcionamento, contato, pagamento e frete. Use quando o cliente perguntar sobre a loja, entrega, pagamento ou horários.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'escalar_humano',
    description:
      'Transfere a conversa para um atendente humano. Use quando o cliente pedir para falar com uma pessoa, quiser negociar, fizer reclamação séria, ou quando você não conseguir resolver. Depois de chamar, avise o cliente que um atendente vai assumir.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: { type: 'string', description: 'Resumo curto do motivo, para o atendente.' },
      },
      required: ['motivo'],
    },
  },
];

async function loadActiveFaqs(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from('faqs')
    .select('question, answer')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .limit(50);
  if (!data || data.length === 0) return '';
  return (data as { question: string; answer: string }[])
    .map((f) => `P: ${f.question}\nR: ${f.answer}`)
    .join('\n\n');
}

function buildSystemBlocks(faqs: string): any[] {
  const blocks: any[] = [
    { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
  ];
  if (faqs) {
    blocks.push({
      type: 'text',
      text:
        'Perguntas frequentes da loja (use como base para dúvidas que não sejam sobre um produto específico; se não estiver aqui nem nas ferramentas, ofereça chamar um atendente):\n\n' +
        faqs,
      cache_control: { type: 'ephemeral' },
    });
  }
  return blocks;
}

// =====================================================================
// Webhook HTTP
// =====================================================================
serve(async (req) => {
  const url = new URL(req.url);

  // --- Verificação do webhook (Meta chama via GET uma única vez) ---
  if (req.method === 'GET') {
    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode === 'subscribe' && token && token === verifyToken) {
      return new Response(challenge ?? '', { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Corpo cru para conferir a assinatura antes de confiar no conteúdo.
  const rawBody = await req.text();

  const appSecret = Deno.env.get('WHATSAPP_APP_SECRET');
  if (appSecret) {
    const ok = await verifyMetaSignature(req, rawBody, appSecret);
    if (!ok) return new Response('invalid signature', { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('bad json', { status: 400 });
  }

  // Extrai as mensagens de texto recebidas (ignora status de entrega etc.)
  const incoming = extractMessages(payload);
  if (incoming.length === 0) {
    return new Response('ok', { status: 200 }); // nada para responder
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY) {
    console.error('Missing env: SUPABASE_URL / SERVICE_ROLE / ANTHROPIC_API_KEY');
    return new Response('ok', { status: 200 }); // não peça reenvio à Meta por erro nosso
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  // Toggle global: admin pode desligar a IA no painel.
  const { data: settings } = await supabase
    .from('store_settings')
    .select('whatsapp_ai_enabled')
    .limit(1)
    .maybeSingle();
  const aiEnabled = settings?.whatsapp_ai_enabled ?? true;

  // FAQs ativas vão no system prompt (cacheado) — atende dúvidas de frete/troca/
  // garantia etc. com rapidez e sem chute.
  const faqs = await loadActiveFaqs(supabase);
  const systemBlocks = buildSystemBlocks(faqs);

  // Processa em background e responde 200 imediatamente (a Meta tem timeout curto).
  const work = Promise.allSettled(
    incoming.map((m) => handleMessage(supabase, anthropic, m, aiEnabled, systemBlocks)),
  );
  // @ts-ignore — EdgeRuntime existe no runtime do Supabase, não nos tipos.
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    // @ts-ignore
    EdgeRuntime.waitUntil(work);
  } else {
    await work;
  }

  return new Response('ok', { status: 200 });
});

// =====================================================================
// Processamento de uma mensagem
// =====================================================================
interface IncomingMessage {
  from: string; // número do cliente (wa_id)
  waId: string; // id da mensagem (wamid...) para dedupe
  name?: string;
  type: string;
  text: string;
  buttonId: string | null; // id do botão clicado (interactive.button_reply.id)
}

async function handleMessage(
  supabase: SupabaseClient,
  anthropic: Anthropic,
  msg: IncomingMessage,
  aiEnabled: boolean,
  system: any[],
) {
  try {
    const convo = await getOrCreateConversation(supabase, msg.from, msg.name);

    // Salva a mensagem do cliente. Se o id já existe, é reentrega → ignora.
    const isNew = await saveMessage(supabase, convo.id, 'user', msg.text || '(sem texto)', msg.waId);
    if (!isNew) return;

    await touchConversation(supabase, convo.id);

    // IA desligada globalmente, ou um humano já assumiu esta conversa → não responde.
    if (!aiEnabled || convo.status === 'human') return;

    // Confirma leitura E liga o "digitando..." (atendimento com cara humana).
    await markReadWithTyping(msg.waId);

    // Clique nos botões da boas-vindas: resposta determinística, instantânea e
    // grátis — NÃO passa pela IA.
    if (msg.buttonId && (await handleButtonClick(supabase, convo, msg))) {
      await touchConversation(supabase, convo.id);
      return;
    }

    // Primeiro contato: manda UMA mensagem de boas-vindas organizada (apresentação,
    // site, endereço/horário) com botões de ação rápida. Só uma vez por conversa.
    const firstContact = !(await hasAssistantReplied(supabase, convo.id));
    if (firstContact) {
      await sendWelcome(supabase, convo, msg.from);
    }

    // Só processamos texto por enquanto.
    if (msg.type !== 'text' || !msg.text) {
      if (!firstContact) {
        const fallback =
          'Recebi sua mensagem. Por aqui consigo te ajudar melhor por texto. Pode me dizer o que você procura?';
        await deliver(supabase, convo, msg.from, fallback);
      }
      return;
    }

    // Se foi só um cumprimento no primeiro contato, a boas-vindas já basta.
    if (firstContact && isJustGreeting(msg.text)) {
      await touchConversation(supabase, convo.id);
      return;
    }

    const history = await loadHistory(supabase, convo.id);
    const reply = await runAI(anthropic, supabase, convo, history, system);

    if (reply) {
      await deliver(supabase, convo, msg.from, reply);
    }
    await touchConversation(supabase, convo.id);
  } catch (e) {
    console.error('handleMessage error:', e);
  }
}

// =====================================================================
// Entrega de respostas (IA ou determinísticas)
// =====================================================================

// Conversa com o mínimo que a entrega precisa. `phone` é o wa_id de ENTRADA
// (chave de lookup — NUNCA sobrescrever); `delivery_phone` é o formato que a
// Meta aceitou entregar (com/sem o 9º dígito), preenchido pelo retry.
type DeliverConvo = { id: string; phone: string; delivery_phone?: string | null };

// Envia texto ao cliente (com retry do 9º dígito) e registra na conversa.
// - Falhou? Loga o erro estruturado e salva mesmo assim com o prefixo
//   '[NAO ENTREGUE] ' — assim o admin vê no painel que o cliente não recebeu.
async function deliver(
  supabase: SupabaseClient,
  convo: DeliverConvo,
  to: string,
  text: string,
): Promise<SendResult> {
  // Se já sabemos o formato entregável, vai direto nele (evita 1 chamada perdida).
  const dest = convo.delivery_phone || to;
  const result = await sendText(dest, text);
  await recordDelivery(supabase, convo, text, result);
  return result;
}

// Registro comum pós-envio (usado pelo deliver e pela boas-vindas interativa).
async function recordDelivery(
  supabase: SupabaseClient,
  convo: DeliverConvo,
  text: string,
  result: SendResult,
) {
  if (!result.ok) {
    logGraphError('whatsapp-webhook', result);
  } else if (result.to && result.to !== (convo.delivery_phone ?? convo.phone)) {
    // O retry entregou num formato alternativo → memoriza em delivery_phone.
    // phone fica intacta: é o wa_id de entrada; mudar quebraria o lookup da
    // próxima mensagem (conversa duplicada, boas-vindas de novo, IA por cima
    // de atendimento humano). Best-effort: se a coluna ainda não existir
    // (migration pendente), só loga — o retry por envio continua cobrindo.
    const { error } = await supabase
      .from('whatsapp_conversations')
      .update({ delivery_phone: result.to })
      .eq('id', convo.id);
    if (error) {
      console.warn('delivery_phone não salvo (rode supabase db push):', error.message);
    } else {
      convo.delivery_phone = result.to;
    }
  }
  const content = result.ok ? text : `[NAO ENTREGUE] ${text}`;
  await saveMessage(supabase, convo.id, 'assistant', content, null);
}

// Boas-vindas do primeiro contato: UMA mensagem interativa com 3 botões de
// ação rápida. Se o envio interativo falhar, cai para texto simples.
async function sendWelcome(
  supabase: SupabaseClient,
  convo: DeliverConvo,
  to: string,
) {
  // body.text de mensagem interativa tem limite de 1024 chars na Meta.
  const welcome = (await buildWelcome(supabase)).slice(0, 1024);
  const dest = convo.delivery_phone || to;

  let result = await sendMessage(dest, {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: welcome },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'ver_produtos', title: 'Ver produtos' } },
          { type: 'reply', reply: { id: 'falar_vendedor', title: 'Falar com vendedor' } },
          { type: 'reply', reply: { id: 'nossa_loja', title: 'Nossa loja' } },
        ],
      },
    },
  });

  if (!result.ok) {
    // Interativa recusada (conta/número sem suporte etc.) → manda como texto.
    logGraphError('whatsapp-webhook boas-vindas interativa', result);
    result = await sendText(dest, welcome);
  }
  await recordDelivery(supabase, convo, welcome, result);
}

// Cliques nos botões da boas-vindas — respostas determinísticas, sem IA.
// Retorna true se o clique foi tratado; false deixa seguir o fluxo normal.
async function handleButtonClick(
  supabase: SupabaseClient,
  convo: DeliverConvo & { customer_name: string | null },
  msg: IncomingMessage,
): Promise<boolean> {
  switch (msg.buttonId) {
    case 'ver_produtos': {
      const text =
        `Nosso catálogo completo está no site, com preço e estoque atualizados:\n${SITE_URL}\n\n` +
        'Me diga o que você procura (bike, peça ou acessório) que eu te ajudo a escolher.';
      await deliver(supabase, convo, msg.from, text);
      return true;
    }
    case 'nossa_loja': {
      const { data } = await supabase
        .from('store_settings')
        .select('store_name, address, city, state, working_hours, whatsapp, contact_email')
        .limit(1)
        .maybeSingle();
      const endereco = [data?.address, data?.city, data?.state].filter(Boolean).join(', ');
      const parts = [`*${data?.store_name || 'Daniel Bike Shop'}*`];
      if (endereco) parts.push(`Endereço: ${endereco}`);
      if (data?.working_hours) parts.push(`Horário: ${data.working_hours}`);
      if (data?.whatsapp) parts.push(`WhatsApp: ${data.whatsapp}`);
      if (data?.contact_email) parts.push(`E-mail: ${data.contact_email}`);
      parts.push(`Site: ${SITE_URL}`);
      await deliver(supabase, convo, msg.from, parts.join('\n'));
      return true;
    }
    case 'falar_vendedor': {
      // Mesma lógica de escalar da ferramenta da IA (status='human' + aviso ao dono).
      await escalarHumano(supabase, convo, 'Cliente clicou em "Falar com vendedor" na boas-vindas');
      const text =
        'Claro! Já chamei um vendedor da equipe — uma pessoa de verdade vai te responder por aqui em breve. 😊';
      await deliver(supabase, convo, msg.from, text);
      return true;
    }
    default:
      return false; // botão desconhecido → segue o fluxo normal
  }
}

// =====================================================================
// Claude — loop de tool use
// =====================================================================
async function runAI(
  anthropic: Anthropic,
  supabase: SupabaseClient,
  convo: { id: string; phone: string; customer_name: string | null },
  history: { role: 'user' | 'assistant'; content: string }[],
  system: any[],
): Promise<string> {
  const messages: any[] = history.map((m) => ({ role: m.role, content: m.content }));
  // A conversa precisa terminar num turno do cliente (nunca "prefill" do assistente).
  while (messages.length && messages[messages.length - 1].role === 'assistant') messages.pop();
  if (messages.length === 0) return '';

  for (let step = 0; step < MAX_TOOL_STEPS; step++) {
    const resp: any = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      // system + ferramentas são o prefixo cacheado → respostas mais rápidas e baratas.
      system,
      tools: TOOLS as any,
      messages,
    });

    if (resp.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: resp.content });
      const results: any[] = [];
      for (const block of resp.content) {
        if (block.type === 'tool_use') {
          const out = await runTool(supabase, convo, block.name, block.input);
          results.push({ type: 'tool_result', tool_use_id: block.id, content: out });
        }
      }
      messages.push({ role: 'user', content: results });
      continue;
    }

    const text = (resp.content || [])
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')
      .trim();
    if (text) return text;
    break;
  }

  return 'Deixa eu chamar um atendente para te ajudar melhor, um instante.';
}

async function runTool(
  supabase: SupabaseClient,
  convo: { id: string; phone: string; customer_name: string | null },
  name: string,
  input: any,
): Promise<string> {
  try {
    switch (name) {
      case 'buscar_produtos':
        return await buscarProdutos(supabase, input?.termo, input?.categoria);
      case 'detalhes_produto':
        return await detalhesProduto(supabase, input?.slug);
      case 'info_loja':
        return await infoLoja(supabase);
      case 'escalar_humano':
        return await escalarHumano(supabase, convo, input?.motivo);
      default:
        return JSON.stringify({ erro: 'ferramenta desconhecida' });
    }
  } catch (e) {
    console.error('runTool error', name, e);
    return JSON.stringify({ erro: 'Falha ao consultar. Tente novamente.' });
  }
}

// ---- Implementações das ferramentas ----
async function buscarProdutos(
  supabase: SupabaseClient,
  termo: string,
  categoria?: string,
): Promise<string> {
  const safe = (termo || '').replace(/[,%()*]/g, ' ').trim().slice(0, 80);
  if (!safe) return JSON.stringify({ resultados: [] });

  let query = supabase
    .from('products')
    .select('name, slug, price, promotional_price, stock_quantity, brand, categories(name, slug)')
    .eq('is_active', true)
    .or(`name.ilike.%${safe}%,brand.ilike.%${safe}%`)
    .limit(8);

  const { data, error } = await query;
  if (error) return JSON.stringify({ erro: 'Falha na busca.' });

  let rows = data ?? [];
  if (categoria) {
    const c = categoria.toLowerCase();
    rows = rows.filter(
      (r: any) =>
        r.categories?.slug?.toLowerCase().includes(c) ||
        r.categories?.name?.toLowerCase().includes(c),
    );
  }

  if (rows.length === 0) {
    return JSON.stringify({ resultados: [], aviso: 'Nenhum produto encontrado para esse termo.' });
  }

  const resultados = rows.map((r: any) => {
    const preco = r.promotional_price ?? r.price;
    return {
      nome: r.name,
      marca: r.brand ?? undefined,
      preco: formatBRL(preco),
      preco_normal: r.promotional_price ? formatBRL(r.price) : undefined,
      em_estoque: (r.stock_quantity ?? 0) > 0,
      categoria: r.categories?.name ?? undefined,
      link: `${SITE_URL}/produto/${r.slug}`,
    };
  });
  return JSON.stringify({ resultados });
}

async function detalhesProduto(supabase: SupabaseClient, slug: string): Promise<string> {
  if (!slug) return JSON.stringify({ erro: 'slug não informado' });
  const { data, error } = await supabase
    .from('products')
    .select(
      'name, slug, description, brand, model, price, promotional_price, stock_quantity, aro, material_quadro, marchas, suspensao, tamanho_quadro, categories(name)',
    )
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return JSON.stringify({ erro: 'Produto não encontrado.' });

  const preco = data.promotional_price ?? data.price;
  return JSON.stringify({
    nome: data.name,
    marca: data.brand ?? undefined,
    modelo: data.model ?? undefined,
    descricao: data.description ?? undefined,
    preco: formatBRL(preco),
    preco_normal: data.promotional_price ? formatBRL(data.price) : undefined,
    em_estoque: (data.stock_quantity ?? 0) > 0,
    estoque: data.stock_quantity ?? 0,
    especificacoes: {
      aro: data.aro ?? undefined,
      material_quadro: data.material_quadro ?? undefined,
      marchas: data.marchas ?? undefined,
      suspensao: data.suspensao ?? undefined,
      tamanho_quadro: data.tamanho_quadro ?? undefined,
    },
    categoria: (data as any).categories?.name ?? undefined,
    link: `${SITE_URL}/produto/${data.slug}`,
  });
}

async function infoLoja(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from('store_settings')
    .select('store_name, address, city, state, working_hours, whatsapp, contact_email, instagram_url')
    .limit(1)
    .maybeSingle();

  return JSON.stringify({
    nome: data?.store_name ?? 'Daniel Bike Shop',
    endereco: data?.address ?? undefined,
    cidade: data?.city ?? 'Belo Horizonte',
    estado: data?.state ?? 'MG',
    horario: data?.working_hours ?? undefined,
    contato: data?.contact_email ?? undefined,
    instagram: data?.instagram_url ?? undefined,
    pagamento_e_frete: STORE_FACTS,
    site: SITE_URL,
  });
}

async function escalarHumano(
  supabase: SupabaseClient,
  convo: { id: string; phone: string; customer_name: string | null },
  motivo: string,
): Promise<string> {
  await supabase.from('whatsapp_conversations').update({ status: 'human' }).eq('id', convo.id);

  // Avisa o dono/atendente, se houver um número configurado.
  const owner = Deno.env.get('WHATSAPP_OWNER_NUMBER');
  if (owner) {
    const aviso = await sendText(
      owner,
      `Atendimento humano solicitado.\nCliente: ${convo.customer_name || convo.phone}\nMotivo: ${motivo || 'não informado'}`,
    );
    if (!aviso.ok) logGraphError('whatsapp-webhook aviso ao dono', aviso);
  }

  return JSON.stringify({
    ok: true,
    instrucao:
      'Conversa transferida para um atendente humano. Avise o cliente, de forma calorosa, que uma pessoa da equipe vai responder em breve.',
  });
}

// =====================================================================
// Supabase — conversas e mensagens
// =====================================================================
async function getOrCreateConversation(supabase: SupabaseClient, phone: string, name?: string) {
  const { data: existing } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('phone', phone)
    .maybeSingle();

  if (existing) {
    if (name && !existing.customer_name) {
      await supabase
        .from('whatsapp_conversations')
        .update({ customer_name: name })
        .eq('id', existing.id);
    }
    return existing;
  }

  const { data: created, error } = await supabase
    .from('whatsapp_conversations')
    .insert({ phone, customer_name: name ?? null })
    .select('*')
    .single();

  if (error) {
    // corrida entre duas mensagens do mesmo número: relê.
    const { data: again } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();
    if (again) return again;
    throw error;
  }
  return created;
}

// Retorna true se inseriu (mensagem nova); false se for reentrega (id duplicado).
async function saveMessage(
  supabase: SupabaseClient,
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  waId: string | null,
): Promise<boolean> {
  const { error } = await supabase.from('whatsapp_messages').insert({
    conversation_id: conversationId,
    role,
    content,
    wa_message_id: waId,
  });
  if (error) {
    if ((error as any).code === '23505') return false; // unique violation = duplicada
    console.error('saveMessage error:', error);
  }
  return true;
}

async function loadHistory(supabase: SupabaseClient, conversationId: string) {
  const { data } = await supabase
    .from('whatsapp_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);
  return ((data ?? []) as { role: 'user' | 'assistant'; content: string }[]).reverse();
}

async function touchConversation(supabase: SupabaseClient, conversationId: string) {
  await supabase
    .from('whatsapp_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);
}

// Já existe alguma resposta do atendente nesta conversa? (define o "primeiro contato")
async function hasAssistantReplied(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('whatsapp_messages')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('role', 'assistant')
    .limit(1);
  return (data?.length ?? 0) > 0;
}

// Mensagem de boas-vindas do primeiro contato — UMA só, organizada e profissional.
// Apresentação do Daniel + link do site + endereço/horário + opção de falar com humano.
async function buildWelcome(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from('store_settings')
    .select('store_name, address, city, state, working_hours')
    .limit(1)
    .maybeSingle();

  const nome = data?.store_name || 'Daniel Bike Shop';
  const endereco = [data?.address, data?.city, data?.state].filter(Boolean).join(', ');

  const parts: string[] = [];
  parts.push(`Olá! Seja bem-vindo à *${nome}* 🚴`);
  parts.push(
    'Aqui é o Daniel. Vou te ajudar a encontrar a bike, peça ou acessório certo e tirar suas dúvidas.',
  );
  parts.push(`Você pode ver tudo e comprar com segurança no nosso site:\n${SITE_URL}`);
  if (endereco || data?.working_hours) {
    const loja = ['*Nossa loja*'];
    if (endereco) loja.push(`Endereço: ${endereco}`);
    if (data?.working_hours) loja.push(`Horário: ${data.working_hours}`);
    parts.push(loja.join('\n'));
  }
  parts.push('Me diga o que você procura. Se preferir falar com um vendedor, é só pedir.');
  return parts.join('\n\n');
}

// Cumprimento "puro" no primeiro contato → a mensagem de boas-vindas já basta.
function isJustGreeting(text: string): boolean {
  const t = text
    .toLowerCase()
    .replace(/[!?.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= 3) return true;
  const greetings = new Set([
    'oi', 'ola', 'olá', 'opa', 'eai', 'e ai', 'e aí',
    'bom dia', 'boa tarde', 'boa noite',
    'oi tudo bem', 'ola tudo bem', 'olá tudo bem', 'tudo bem',
    'oi bom dia', 'oi boa tarde', 'oi boa noite',
    'quero informacoes', 'quero informações', 'queria informacoes', 'queria informações',
    'gostaria de informacoes', 'gostaria de informações',
    'informacoes', 'informações', 'quero saber mais', 'menu', 'inicio', 'início',
  ]);
  return greetings.has(t);
}

// =====================================================================
// Meta WhatsApp Cloud API
// =====================================================================
function extractMessages(payload: any): IncomingMessage[] {
  const out: IncomingMessage[] = [];
  const entries = payload?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      const contacts = value?.contacts ?? [];
      const nameByWaId: Record<string, string> = {};
      for (const c of contacts) {
        if (c?.wa_id) nameByWaId[c.wa_id] = c?.profile?.name;
      }
      for (const m of value?.messages ?? []) {
        const text =
          m?.type === 'text'
            ? m?.text?.body
            : m?.type === 'button'
              ? m?.button?.text
              : m?.type === 'interactive'
                ? m?.interactive?.button_reply?.title ||
                  m?.interactive?.list_reply?.title ||
                  ''
                : '';
        out.push({
          from: m?.from,
          waId: m?.id,
          name: nameByWaId[m?.from],
          type: m?.type ?? 'unknown',
          text: text ?? '',
          // id do botão clicado (respostas dos botões da boas-vindas)
          buttonId: m?.interactive?.button_reply?.id ?? null,
        });
      }
    }
  }
  return out.filter((m) => m.from && m.waId);
}

// (envio, split de mensagens e marcação de leitura vivem em ../_shared/whatsapp.ts)

// HMAC-SHA256 do corpo cru com o App Secret == header x-hub-signature-256.
async function verifyMetaSignature(req: Request, rawBody: string, appSecret: string): Promise<boolean> {
  const header = req.headers.get('x-hub-signature-256');
  if (!header || !header.startsWith('sha256=')) return false;
  const provided = header.slice('sha256='.length);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  // comparação de tamanho constante
  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}
