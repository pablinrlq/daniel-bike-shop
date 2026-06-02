import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const errorMessages: Record<string, string> = {
  invalid_code: 'Informe um código de cupom.',
  not_found: 'Cupom inválido ou expirado.',
  not_started: 'Este cupom ainda não está ativo.',
  expired: 'Este cupom expirou.',
  max_uses_reached: 'Este cupom atingiu o limite de uso.',
  below_minimum: 'O valor mínimo do pedido para usar este cupom não foi atingido.',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing Supabase env vars');
    }

    const { code, subtotal } = await req.json().catch(() => ({}));

    if (typeof code !== 'string' || typeof subtotal !== 'number' || subtotal < 0) {
      return new Response(
        JSON.stringify({ valid: false, error: 'invalid_input', message: 'Dados inválidos.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await supabase.rpc('validate_coupon', {
      _code: code,
      _subtotal: subtotal,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;

    if (!row || !row.valid) {
      const errKey = row?.error || 'not_found';
      return new Response(
        JSON.stringify({
          valid: false,
          error: errKey,
          message: errorMessages[errKey] || 'Não foi possível aplicar o cupom.',
          minOrderValue: row?.min_order_value ? Number(row.min_order_value) : undefined,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    return new Response(
      JSON.stringify({
        valid: true,
        code: row.code,
        discountType: row.discount_type,
        discountValue: Number(row.discount_value),
        minOrderValue: Number(row.min_order_value ?? 0),
        discountAmount: Number(row.discount_amount ?? 0),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (e) {
    console.error('validate-coupon error:', e);
    return new Response(
      JSON.stringify({ valid: false, error: 'server_error', message: 'Erro interno ao validar cupom.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});
