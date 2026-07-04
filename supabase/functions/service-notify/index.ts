// service-notify — avisa o cliente no WhatsApp quando o status de uma ordem de
// serviço muda. Chamada pelo painel admin (usuário autenticado admin/editor).
//
// Observação importante sobre WhatsApp: mensagens proativas (fora da janela de
// 24h desde a última mensagem do cliente) exigem um TEMPLATE aprovado na Meta.
// Esta função envia:
//   - um TEMPLATE, se WHATSAPP_SERVICE_TEMPLATE estiver configurado (recomendado);
//   - senão, texto livre (funciona quando o cliente falou com a loja nas últimas 24h).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
// Envio via Meta Cloud API com retry do "9º dígito" BR e log estruturado de erro.
import { sendMessage, sendText, onlyDigits, logGraphError } from '../_shared/whatsapp.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Garante DDI 55 (Brasil) quando vier só DDD + número.
const normalizePhone = (raw: string) => {
  const d = onlyDigits(raw);
  if (!d) return '';
  return d.length <= 11 ? `55${d}` : d;
};

const STATUS_MESSAGE: Record<string, string> = {
  nao_iniciado: 'Recebemos seu equipamento e seu serviço está na fila de atendimento.',
  em_andamento: 'Boa notícia! Seu serviço já está em andamento.',
  concluido: 'Seu serviço foi concluído! Já pode retirar na loja ou combinar a entrega com a gente.',
  entregue: 'Serviço entregue. Obrigado pela preferência! Qualquer coisa, é só chamar.',
  cancelado: 'Seu serviço foi cancelado. Se tiver qualquer dúvida, fale com a gente por aqui.',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;

    // --- Autorização: só admin/editor logado ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ success: false, message: 'Não autorizado' }, 401);
    }
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) return json({ success: false, message: 'Sessão inválida' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: role } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'editor'])
      .maybeSingle();
    if (!role) return json({ success: false, message: 'Acesso restrito à equipe' }, 403);

    // --- Ordem de serviço ---
    const { serviceOrderId } = await req.json().catch(() => ({}));
    if (!serviceOrderId) return json({ success: false, message: 'serviceOrderId é obrigatório' }, 400);

    const { data: order, error } = await admin
      .from('service_orders')
      .select('customer_name, customer_phone, equipment, status, notify_whatsapp')
      .eq('id', serviceOrderId)
      .maybeSingle();
    if (error || !order) return json({ success: false, message: 'Serviço não encontrado' }, 404);

    if (!order.notify_whatsapp) {
      return json({ success: true, skipped: 'notificação desativada para este serviço' }, 200);
    }

    const to = normalizePhone(order.customer_phone);
    if (!to) return json({ success: false, message: 'Telefone do cliente inválido' }, 400);

    const TOKEN = Deno.env.get('WHATSAPP_TOKEN');
    const PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    if (!TOKEN || !PHONE_ID) {
      return json({ success: false, message: 'WhatsApp não configurado' }, 503);
    }

    const firstName = (order.customer_name || '').trim().split(/\s+/)[0] || 'tudo bem';
    const statusText = STATUS_MESSAGE[order.status] ?? `Status do seu serviço: ${order.status}.`;
    const equipment = order.equipment ? ` (${order.equipment})` : '';
    const fullText = `Olá, ${firstName}! Atualização do seu serviço na Daniel Bike Shop${equipment}:\n\n${statusText}`;

    const template = Deno.env.get('WHATSAPP_SERVICE_TEMPLATE'); // nome do template aprovado (opcional)
    const templateLang = Deno.env.get('WHATSAPP_SERVICE_TEMPLATE_LANG') || 'pt_BR';

    // Envio via módulo compartilhado: retry automático do 9º dígito BR (131030).
    const result = template
      ? await sendMessage(to, {
          type: 'template',
          template: {
            name: template,
            language: { code: templateLang },
            // O template precisa ter 2 variáveis no corpo: {{1}} nome, {{2}} status.
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: firstName },
                  { type: 'text', text: statusText },
                ],
              },
            ],
          },
        })
      : await sendText(to, fullText, { previewUrl: false });

    if (!result.ok) {
      logGraphError('service-notify', result);
      // 131047 / janela de 24h: cliente precisa ter falado recentemente OU usar template.
      return json(
        {
          success: false,
          message:
            'Falha ao enviar no WhatsApp. Para avisos fora da janela de 24h, configure um template aprovado (WHATSAPP_SERVICE_TEMPLATE).',
          errorCode: result.errorCode,
          detail: result.errorMessage,
        },
        502,
      );
    }

    return json({ success: true, sentVia: template ? 'template' : 'text' }, 200);
  } catch (e) {
    console.error('service-notify error:', e);
    return json({ success: false, message: e instanceof Error ? e.message : 'Erro interno' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
