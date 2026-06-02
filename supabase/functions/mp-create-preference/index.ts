import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderRow {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_address: string;
  customer_city: string;
  customer_state: string;
  customer_zip: string;
  subtotal: number;
  shipping_cost: number;
  discount_amount: number;
  total: number;
  payment_status: string;
}

interface OrderItemRow {
  product_name: string;
  product_price: number;
  quantity: number;
}

const onlyDigits = (s: string | null | undefined) =>
  (s ?? '').replace(/\D+/g, '');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    const PUBLIC_SITE_URL = Deno.env.get('PUBLIC_SITE_URL') || '';

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase env vars');
    }
    if (!MP_ACCESS_TOKEN) {
      throw new Error('Missing MP_ACCESS_TOKEN');
    }

    const { orderId, paymentMethod } = await req.json().catch(() => ({}));

    if (!orderId || typeof orderId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'invalid_input', message: 'orderId é obrigatório.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        `id, customer_name, customer_email, customer_phone, customer_address,
         customer_city, customer_state, customer_zip, subtotal, shipping_cost,
         discount_amount, total, payment_status`,
      )
      .eq('id', orderId)
      .single<OrderRow>();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    if (order.payment_status === 'paid') {
      return new Response(
        JSON.stringify({ error: 'already_paid', message: 'Este pedido já foi pago.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 },
      );
    }

    const { data: items } = await supabase
      .from('order_items')
      .select('product_name, product_price, quantity')
      .eq('order_id', orderId)
      .returns<OrderItemRow[]>();

    if (!items || items.length === 0) {
      throw new Error('Order has no items');
    }

    // Total in MP must match — distribute discount/shipping into a single adjustment item
    const mpItems = items.map((item) => ({
      title: item.product_name.slice(0, 250),
      quantity: item.quantity,
      unit_price: Number(item.product_price),
      currency_id: 'BRL',
    }));

    if (Number(order.shipping_cost) > 0) {
      mpItems.push({
        title: 'Frete',
        quantity: 1,
        unit_price: Number(order.shipping_cost),
        currency_id: 'BRL',
      });
    }

    if (Number(order.discount_amount) > 0) {
      mpItems.push({
        title: 'Desconto',
        quantity: 1,
        unit_price: -Number(order.discount_amount),
        currency_id: 'BRL',
      });
    }

    const [firstName, ...rest] = (order.customer_name || '').trim().split(/\s+/);
    const lastName = rest.join(' ') || firstName;

    const baseUrl = PUBLIC_SITE_URL.replace(/\/$/, '');
    const backUrls = baseUrl
      ? {
          success: `${baseUrl}/conta?pedido=${order.id}&status=success`,
          pending: `${baseUrl}/conta?pedido=${order.id}&status=pending`,
          failure: `${baseUrl}/conta?pedido=${order.id}&status=failure`,
        }
      : undefined;

    const preference: Record<string, unknown> = {
      items: mpItems,
      external_reference: order.id,
      statement_descriptor: 'DANIELBIKE',
      payer: {
        name: firstName || order.customer_name,
        surname: lastName,
        email: order.customer_email,
        phone: order.customer_phone
          ? {
              area_code: onlyDigits(order.customer_phone).slice(0, 2),
              number: onlyDigits(order.customer_phone).slice(2),
            }
          : undefined,
        address: {
          zip_code: onlyDigits(order.customer_zip),
          street_name: order.customer_address,
        },
      },
      back_urls: backUrls,
      auto_return: backUrls ? 'approved' : undefined,
      notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
    };

    if (paymentMethod === 'pix') {
      preference.payment_methods = {
        excluded_payment_types: [
          { id: 'credit_card' },
          { id: 'debit_card' },
          { id: 'ticket' },
          { id: 'atm' },
        ],
      };
    } else if (paymentMethod === 'card') {
      preference.payment_methods = {
        excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }, { id: 'bank_transfer' }],
      };
    }

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `${order.id}-${paymentMethod || 'any'}`,
      },
      body: JSON.stringify(preference),
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error('Mercado Pago error:', mpResponse.status, errorText);
      throw new Error(`Mercado Pago: ${mpResponse.status}`);
    }

    const mpData = await mpResponse.json();

    await supabase
      .from('orders')
      .update({
        payment_method: paymentMethod || 'mercadopago',
        payment_provider: 'mercadopago',
        payment_provider_id: mpData.id,
      })
      .eq('id', orderId);

    return new Response(
      JSON.stringify({
        preferenceId: mpData.id,
        initPoint: mpData.init_point,
        sandboxInitPoint: mpData.sandbox_init_point,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (e) {
    console.error('mp-create-preference error:', e);
    return new Response(
      JSON.stringify({
        error: 'server_error',
        message: e instanceof Error ? e.message : 'Erro ao iniciar pagamento.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
