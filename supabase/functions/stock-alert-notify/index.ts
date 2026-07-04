// stock-alert-notify — dispara o "avise-me quando chegar".
// Roda em agendamento (pg_cron). Procura pedidos de aviso pendentes cujo produto
// voltou ao estoque e manda a mensagem no WhatsApp do cliente.
//
// Obs. Meta: aviso proativo fora da janela de 24h exige TEMPLATE aprovado.
// Configure WHATSAPP_STOCK_TEMPLATE (corpo com {{1}} nome, {{2}} produto) para
// garantir a entrega; sem ele, manda texto livre (só funciona dentro de 24h).

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
// Envio via Meta Cloud API com retry do "9º dígito" BR e log estruturado de erro.
import { sendMessage, sendText, onlyDigits, logGraphError } from '../_shared/whatsapp.ts';

const SITE_URL = (Deno.env.get('PUBLIC_SITE_URL') || 'https://danielbikeshop.com').replace(/\/$/, '');
const normalizePhone = (raw: string) => {
  const d = onlyDigits(raw);
  return d.length <= 11 ? `55${d}` : d;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');

  const secret = Deno.env.get('FOLLOWUP_SECRET');
  if (secret && req.headers.get('x-followup-secret') !== secret) {
    return json({ error: 'unauthorized' }, 401);
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const TOKEN = Deno.env.get('WHATSAPP_TOKEN');
    const PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    if (!TOKEN || !PHONE_ID) return json({ error: 'whatsapp_not_configured' }, 503);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data, error } = await supabase
      .from('stock_alerts')
      .select('id, product_name, customer_name, customer_phone, products(slug, stock_quantity)')
      .eq('notified', false)
      .limit(100);
    if (error) throw error;

    const template = Deno.env.get('WHATSAPP_STOCK_TEMPLATE');
    const templateLang = Deno.env.get('WHATSAPP_STOCK_TEMPLATE_LANG') || 'pt_BR';

    let sent = 0;
    let skipped = 0;

    for (const a of (data ?? []) as any[]) {
      try {
        const stock = a.products?.stock_quantity ?? 0;
        if (stock <= 0) {
          skipped++;
          continue;
        }
        const to = normalizePhone(a.customer_phone);
        if (!to) {
          skipped++;
          continue;
        }
        const firstName = (a.customer_name || '').trim().split(/\s+/)[0] || 'tudo bem';
        const link = a.products?.slug ? `${SITE_URL}/produto/${a.products.slug}` : SITE_URL;
        const textBody =
          `Boa notícia, ${firstName}! O produto que você queria voltou ao estoque na Daniel Bike Shop:\n\n` +
          `*${a.product_name}*\n${link}\n\nQuer que eu já reserve o seu?`;

        // Envio via módulo compartilhado: retry automático do 9º dígito BR (131030).
        const result = template
          ? await sendMessage(to, {
              type: 'template',
              template: {
                name: template,
                language: { code: templateLang },
                components: [
                  {
                    type: 'body',
                    parameters: [
                      { type: 'text', text: firstName },
                      { type: 'text', text: a.product_name },
                    ],
                  },
                ],
              },
            })
          : await sendText(to, textBody, { previewUrl: true });
        if (!result.ok) {
          logGraphError('stock-alert-notify', result);
          skipped++;
          continue;
        }
        await supabase
          .from('stock_alerts')
          .update({ notified: true, notified_at: new Date().toISOString() })
          .eq('id', a.id);
        sent++;
      } catch (e) {
        console.error('stock-alert item error', a?.id, e);
        skipped++;
      }
    }

    return json({ ok: true, sent, skipped, pending: data?.length ?? 0 }, 200);
  } catch (e) {
    console.error('stock-alert-notify error:', e);
    return json({ error: 'server_error', message: e instanceof Error ? e.message : 'erro' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
