import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type EmailKind = 'created' | 'paid';

const subjects: Record<EmailKind, string> = {
  created: 'Recebemos seu pedido — Daniel Bike Shop',
  paid: 'Pagamento confirmado — Daniel Bike Shop',
};

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );

const buildHtml = (kind: EmailKind, order: any, items: any[]): string => {
  const intro =
    kind === 'paid'
      ? 'Recebemos a confirmação do seu pagamento. Já estamos preparando seu pedido!'
      : 'Recebemos seu pedido. Em breve enviaremos novidades sobre o pagamento e a entrega.';

  const itemsHtml = items
    .map(
      (i) => `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #eee;">
            ${i.quantity}x ${escape(i.product_name)}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">
            ${formatBRL(Number(i.subtotal))}
          </td>
        </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="pt-BR"><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; color:#222; background:#f6f6f6; margin:0; padding:24px;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;">
    <tr><td>
      <h1 style="font-size:20px;margin:0 0 8px;">${escape(subjects[kind])}</h1>
      <p style="color:#555;margin:0 0 16px;">${intro}</p>
      <p style="margin:0 0 16px;"><strong>Pedido:</strong> #${String(order.id).slice(0, 8).toUpperCase()}</p>
      <table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
        ${itemsHtml}
        <tr>
          <td style="padding:8px 0;">Subtotal</td>
          <td style="padding:8px 0;text-align:right;">${formatBRL(Number(order.subtotal))}</td>
        </tr>
        ${Number(order.discount_amount) > 0
          ? `<tr><td style="padding:8px 0;color:#2563eb;">Desconto ${order.coupon_code ? `(${escape(order.coupon_code)})` : ''}</td>
             <td style="padding:8px 0;text-align:right;color:#2563eb;">-${formatBRL(Number(order.discount_amount))}</td></tr>`
          : ''}
        <tr>
          <td style="padding:8px 0;">Frete</td>
          <td style="padding:8px 0;text-align:right;">${Number(order.shipping_cost) === 0 ? 'Grátis' : formatBRL(Number(order.shipping_cost))}</td>
        </tr>
        <tr>
          <td style="padding:12px 0 0;font-weight:bold;border-top:1px solid #eee;">Total</td>
          <td style="padding:12px 0 0;text-align:right;font-weight:bold;border-top:1px solid #eee;">${formatBRL(Number(order.total))}</td>
        </tr>
      </table>
      <p style="margin:24px 0 0;font-size:13px;color:#666;">
        Qualquer dúvida, responda este e-mail ou fale com a gente no WhatsApp.<br/>
        — Equipe Daniel Bike Shop
      </p>
    </td></tr>
  </table>
</body></html>`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const RESEND_FROM = Deno.env.get('RESEND_FROM') || 'Daniel Bike Shop <no-reply@danielbikeshop.com>';

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase env vars');
    }
    if (!RESEND_API_KEY) {
      // Soft-fail: e-mail is not blocking. Log and return 200 so callers don't retry.
      console.warn('RESEND_API_KEY not set; email skipped.');
      return new Response(JSON.stringify({ skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const { orderId, kind } = await req.json().catch(() => ({}));

    if (!orderId || (kind !== 'created' && kind !== 'paid')) {
      return new Response(JSON.stringify({ error: 'invalid_input' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) throw new Error('Order not found');

    const { data: items } = await supabase
      .from('order_items')
      .select('product_name, product_price, quantity, subtotal')
      .eq('order_id', orderId);

    const html = buildHtml(kind as EmailKind, order, items ?? []);

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [order.customer_email],
        subject: subjects[kind as EmailKind],
        html,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Resend error:', resp.status, errText);
      throw new Error(`Resend: ${resp.status}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    console.error('send-order-email error:', e);
    return new Response(
      JSON.stringify({ error: 'server_error', message: e instanceof Error ? e.message : 'error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
