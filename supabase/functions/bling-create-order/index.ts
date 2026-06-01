import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BLING_API_BASE = 'https://www.bling.com.br/Api/v3';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const BLING_CLIENT_ID = Deno.env.get('BLING_CLIENT_ID')!;
    const BLING_CLIENT_SECRET = Deno.env.get('BLING_CLIENT_SECRET')!;
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { orderId } = body;

    if (!orderId) throw new Error('orderId is required');

    console.log('Processing order:', orderId);

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) throw new Error(`Order not found: ${orderId}`);

    // Idempotência: se já existe um bling_order para este order, retornar o existente
    // ao invés de criar duplicata na Bling/NF-e (que custaria $$ ao lojista).
    const { data: existingBlingOrder } = await supabase
      .from('bling_orders')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (existingBlingOrder) {
      console.log('Order already processed in Bling, returning existing:', existingBlingOrder.bling_order_id);
      return new Response(
        JSON.stringify({
          success: true,
          alreadyProcessed: true,
          blingOrderId: existingBlingOrder.bling_order_id,
          orderNumber: existingBlingOrder.bling_order_id,
          nfeId: existingBlingOrder.bling_nfe_id || '',
          nfeNumber: existingBlingOrder.bling_nfe_number || '',
          nfeIssued: !!existingBlingOrder.bling_nfe_number,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Só processar pedidos recentes (até 24h) — limita janela de abuso
    // por reuso de orderIds vazados.
    const orderAgeMs = Date.now() - new Date(order.created_at).getTime();
    if (orderAgeMs > 24 * 60 * 60 * 1000) {
      throw new Error('Order is too old to be processed automatically');
    }

    const { data: items } = await supabase
      .from('order_items')
      .select('*, products(sku)')
      .eq('order_id', orderId);

    // Get access token
    const { data: tokenData, error: tokenError } = await supabase
      .from('bling_oauth_tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError || !tokenData) {
      throw new Error('Bling not connected');
    }

    let accessToken = tokenData.access_token;
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();

    // Refresh token if expired
    if (expiresAt.getTime() - now.getTime() < 300000) {
      const credentials = btoa(`${BLING_CLIENT_ID}:${BLING_CLIENT_SECRET}`);
      const refreshResponse = await fetch(`${BLING_API_BASE}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: tokenData.refresh_token,
        }),
      });

      if (!refreshResponse.ok) throw new Error('Token refresh failed');

      const newTokenData = await refreshResponse.json();
      const newExpiresAt = new Date(Date.now() + (newTokenData.expires_in * 1000));

      await supabase.from('bling_oauth_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('bling_oauth_tokens').insert({
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token,
        expires_at: newExpiresAt.toISOString(),
      });

      accessToken = newTokenData.access_token;
    }

    // Helper function for Bling API calls
    const blingRequest = async (endpoint: string, options: RequestInit = {}) => {
      const response = await fetch(`${BLING_API_BASE}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Bling API: ${response.status} - ${errorText}`);
      }

      return response.json();
    };

    // 1. Create/find contact
    let contactId = '';
    try {
      const searchResult = await blingRequest(`/contatos?pesquisa=${encodeURIComponent(order.customer_email)}`);
      if (searchResult.data?.length > 0) {
        contactId = searchResult.data[0].id.toString();
      } else {
        const contactPayload = {
          nome: order.customer_name,
          tipo: 'F',
          contribuinte: 9,
          email: order.customer_email,
          telefone: order.customer_phone.replace(/\D/g, ''),
          endereco: {
            endereco: order.customer_address,
            numero: 'S/N',
            municipio: order.customer_city,
            uf: order.customer_state.toUpperCase(),
            cep: order.customer_zip.replace(/\D/g, ''),
          },
        };
        const createResult = await blingRequest('/contatos', {
          method: 'POST',
          body: JSON.stringify(contactPayload),
        });
        contactId = createResult.data.id.toString();
      }
    } catch (e) {
      console.error('Contact error:', e);
    }

    // 2. Create order
    const blingItems = items?.map((item: any, index: number) => ({
      codigo: item.products?.sku || `PROD-${index}`,
      descricao: item.product_name,
      unidade: 'UN',
      quantidade: item.quantity,
      valor: item.product_price,
    })) || [];

    const orderPayload = {
      contato: { id: contactId ? parseInt(contactId) : undefined },
      itens: blingItems,
      transporte: { frete: order.shipping_cost },
      observacoes: order.notes || 'Pedido via site',
    };

    const orderResult = await blingRequest('/pedidos/vendas', {
      method: 'POST',
      body: JSON.stringify(orderPayload),
    });

    const blingOrderId = orderResult.data.id.toString();
    const orderNumber = orderResult.data.numero?.toString() || blingOrderId;

    // 3. Try to issue NF-e
    let nfeId = '', nfeNumber = '';
    try {
      const nfePayload = { idsPedidosVendas: [parseInt(blingOrderId)], finalidade: 1, tipo: 1 };
      const nfeResult = await blingRequest('/nfe', {
        method: 'POST',
        body: JSON.stringify(nfePayload),
      });
      
      if (nfeResult.data?.id) {
        nfeId = nfeResult.data.id.toString();
        await blingRequest(`/nfe/${nfeId}/enviar`, { method: 'POST' });
        const nfeDetails = await blingRequest(`/nfe/${nfeId}`);
        nfeNumber = nfeDetails.data?.numero?.toString() || nfeId;
      }
    } catch (e) {
      console.error('NF-e error:', e);
    }

    // 4. Save Bling order info
    await supabase.from('bling_orders').insert({
      order_id: orderId,
      bling_order_id: blingOrderId,
      bling_nfe_id: nfeId || null,
      bling_nfe_number: nfeNumber || null,
      bling_contact_id: contactId || null,
      status: nfeNumber ? 'nfe_issued' : 'order_created',
    });

    await supabase.from('orders').update({ status: 'confirmed' }).eq('id', orderId);

    console.log('Order processed:', { blingOrderId, orderNumber, nfeId, nfeNumber });

    return new Response(
      JSON.stringify({
        success: true,
        blingOrderId,
        orderNumber,
        nfeId,
        nfeNumber,
        nfeIssued: !!nfeNumber,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Order processing error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
