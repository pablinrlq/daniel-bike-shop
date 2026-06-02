import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
};

const mapStatus = (mpStatus: string): { paymentStatus: string; orderStatus?: string } => {
  switch (mpStatus) {
    case 'approved':
      return { paymentStatus: 'paid', orderStatus: 'paid' };
    case 'in_process':
    case 'pending':
    case 'authorized':
      return { paymentStatus: 'pending' };
    case 'rejected':
    case 'cancelled':
      return { paymentStatus: 'failed' };
    case 'refunded':
    case 'charged_back':
      return { paymentStatus: 'refunded', orderStatus: 'cancelled' };
    default:
      return { paymentStatus: mpStatus };
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    const MP_WEBHOOK_SECRET = Deno.env.get('MP_WEBHOOK_SECRET');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !MP_ACCESS_TOKEN) {
      throw new Error('Missing env vars');
    }

    // Mercado Pago sends notifications via POST. They also retry, so this needs to be idempotent.
    const body = await req.json().catch(() => null);
    const url = new URL(req.url);

    const topic = body?.type || body?.topic || url.searchParams.get('type') || url.searchParams.get('topic');
    const dataId =
      body?.data?.id || url.searchParams.get('data.id') || url.searchParams.get('id');

    // Optional signature verification (only if MP_WEBHOOK_SECRET is configured)
    if (MP_WEBHOOK_SECRET) {
      const signature = req.headers.get('x-signature');
      const requestId = req.headers.get('x-request-id');
      if (!signature || !requestId || !dataId) {
        return new Response(JSON.stringify({ error: 'missing_signature' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }
      const parts = Object.fromEntries(
        signature.split(',').map((p) => p.trim().split('=') as [string, string]),
      );
      const ts = parts.ts;
      const hash = parts.v1;
      if (!ts || !hash) {
        return new Response(JSON.stringify({ error: 'bad_signature' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }
      const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(MP_WEBHOOK_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      );
      const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest));
      const expected = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      if (expected !== hash) {
        return new Response(JSON.stringify({ error: 'invalid_signature' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }
    }

    if (topic !== 'payment' || !dataId) {
      // Acknowledge other topics so MP doesn't retry forever
      return new Response(JSON.stringify({ ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const paymentResp = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    if (!paymentResp.ok) {
      const txt = await paymentResp.text();
      console.error('MP payment fetch failed:', paymentResp.status, txt);
      throw new Error('Failed to fetch payment');
    }
    const payment = await paymentResp.json();

    const orderId: string | undefined = payment.external_reference;
    if (!orderId) {
      return new Response(JSON.stringify({ ignored: true, reason: 'no_external_reference' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { paymentStatus, orderStatus } = mapStatus(payment.status);

    // Read previous status to only send confirmation email on the first transition
    const { data: previous } = await supabase
      .from('orders')
      .select('payment_status')
      .eq('id', orderId)
      .single();

    const update: Record<string, unknown> = {
      payment_status: paymentStatus,
      payment_provider: 'mercadopago',
      payment_provider_id: String(payment.id),
      payment_method: payment.payment_type_id || payment.payment_method_id,
    };
    if (orderStatus) update.status = orderStatus;

    const { error } = await supabase.from('orders').update(update).eq('id', orderId);
    if (error) {
      console.error('Order update error:', error);
      throw error;
    }

    if (paymentStatus === 'paid' && previous?.payment_status !== 'paid') {
      supabase.functions
        .invoke('send-order-email', { body: { orderId, kind: 'paid' } })
        .catch((e) => console.error('send-order-email (paid) failed:', e));

      // Also fire Bling order creation in case it wasn't done at checkout
      supabase.functions
        .invoke('bling-create-order', { body: { orderId } })
        .catch((e) => console.error('bling-create-order (post-payment) failed:', e));
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    console.error('mp-webhook error:', e);
    return new Response(
      JSON.stringify({ error: 'server_error', message: e instanceof Error ? e.message : 'error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
