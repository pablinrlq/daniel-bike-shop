import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BLING_API_BASE = 'https://www.bling.com.br/Api/v3';

// Bling tem limite de ~3 req/seg. Mantemos 350ms entre calls.
const BLING_THROTTLE_MS = 350;
// Quantos produtos processar por execucao da function (evita timeout do edge runtime)
const DEFAULT_BATCH_SIZE = 80;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const batchSize = Number((body as { batchSize?: number }).batchSize) || DEFAULT_BATCH_SIZE;
    const skipImageDetail = Boolean((body as { skipImageDetail?: boolean }).skipImageDetail);
    const startPage = Math.max(1, Number((body as { startPage?: number }).startPage) || 1);

    console.log(`Starting Bling product sync — batchSize=${batchSize} skipImageDetail=${skipImageDetail} startPage=${startPage}`);

    // Get access token
    const { data: tokenData, error: tokenError } = await supabase
      .from('bling_oauth_tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError || !tokenData) {
      throw new Error('Bling not connected. Please authorize first.');
    }

    let accessToken = tokenData.access_token;
    const expiresAt = new Date(tokenData.expires_at);
    const now = new Date();

    // Refresh token if expired (or expiring in <5 min)
    if (expiresAt.getTime() - now.getTime() < 300000) {
      console.log('Token expired, refreshing...');
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

      if (!refreshResponse.ok) throw new Error('Failed to refresh token');

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

    // ---- Helpers ----
    // Bling fetch com retry no 429 (rate limit). Espera Retry-After se presente.
    const blingFetch = async (path: string, attempt = 1): Promise<Response> => {
      const resp = await fetch(`${BLING_API_BASE}${path}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });
      if (resp.status === 429 && attempt <= 4) {
        const retryAfter = Number(resp.headers.get('retry-after')) || 2;
        console.log(`429 on ${path}, sleeping ${retryAfter}s (attempt ${attempt}/4)`);
        await sleep(retryAfter * 1000);
        return blingFetch(path, attempt + 1);
      }
      return resp;
    };

    // Helper: extrai URLs de imagem em alta resolucao do detalhe do produto Bling.
    const fetchHighResImages = async (blingProductId: string): Promise<string[]> => {
      try {
        const detailResp = await blingFetch(`/produtos/${blingProductId}`);
        if (!detailResp.ok) return [];
        const detail = await detailResp.json();
        const midia = detail?.data?.midia?.imagens;
        const externas: string[] = (midia?.externas ?? [])
          .map((img: { link?: string }) => img?.link)
          .filter(Boolean);
        const internas: string[] = (midia?.internas ?? [])
          .map((img: { link?: string }) => img?.link)
          .filter(Boolean);
        const all = [...externas, ...internas];
        return Array.from(new Set(all));
      } catch (e) {
        console.error('Failed to fetch detail for', blingProductId, e);
        return [];
      }
    };

    const syncProductImages = async (productDbId: string, urls: string[], fallback?: string) => {
      const list = urls.length > 0 ? urls : fallback ? [fallback] : [];
      if (list.length === 0) return false;
      await supabase.from('product_images').delete().eq('product_id', productDbId);
      const rows = list.map((url, index) => ({
        product_id: productDbId,
        image_url: url,
        is_primary: index === 0,
        display_order: index,
      }));
      const { error: insertImgError } = await supabase.from('product_images').insert(rows);
      if (insertImgError) {
        console.error('Failed to insert product images:', productDbId, insertImgError);
        return false;
      }
      return true;
    };

    // ---- 1) Listagem de produtos com paginacao ate completar o batch ----
    const collected: any[] = [];
    let page = startPage;
    let lastPageFetched = startPage - 1;
    while (collected.length < batchSize && page <= 50) {
      const response = await blingFetch(`/produtos?pagina=${page}&limite=100`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Bling API error (listagem pagina ${page}): ${response.status} - ${errorText}`);
      }
      const result = await response.json();
      const items = (result?.data ?? []) as any[];
      if (items.length === 0) break;
      collected.push(...items);
      lastPageFetched = page;
      page++;
      if (items.length < 100) break;
      await sleep(BLING_THROTTLE_MS);
    }

    const toProcess = collected.slice(0, batchSize);
    console.log(`Pagina inicial=${startPage}, ultima pagina lida=${lastPageFetched}, coletados=${collected.length}, processando=${toProcess.length}`);

    let synced = 0;
    let failed = 0;
    let imagesUpdated = 0;

    for (const product of toProcess) {
      try {
        const productId = product.id.toString();

        await supabase
          .from('bling_products_cache')
          .upsert({
            bling_product_id: productId,
            data: product,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'bling_product_id' });

        const rawName = (product.nome ?? '').toString();
        if (!rawName.trim()) {
          failed++;
          continue;
        }

        const slug = rawName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[̀-ͯ]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        const productData = {
          sku: product.codigo || productId,
          name: rawName,
          slug: `${slug}-${productId}`,
          description: product.descricaoCurta || product.observacoes || null,
          price: parseFloat(product.preco) || 0,
          promotional_price: product.precoPromocional ? parseFloat(product.precoPromocional) : null,
          stock_quantity: product.estoque?.saldoVirtualTotal || 0,
          is_active: product.situacao === 'A',
          brand: product.marca || null,
        };

        const { data: existingProduct } = await supabase
          .from('products')
          .select('id')
          .eq('sku', productData.sku)
          .maybeSingle();

        let dbProductId: string | undefined;
        if (existingProduct) {
          await supabase
            .from('products')
            .update({
              name: productData.name,
              description: productData.description,
              price: productData.price,
              promotional_price: productData.promotional_price,
              stock_quantity: productData.stock_quantity,
              is_active: productData.is_active,
              brand: productData.brand,
            })
            .eq('id', existingProduct.id);
          dbProductId = existingProduct.id;
        } else {
          const { data: newProduct, error: insertError } = await supabase
            .from('products')
            .insert(productData)
            .select('id')
            .single();
          if (insertError) {
            console.error('Failed to insert product:', productData.sku, insertError);
            failed++;
            continue;
          }
          dbProductId = newProduct.id;
        }

        if (dbProductId) {
          let hdImages: string[] = [];
          if (!skipImageDetail) {
            hdImages = await fetchHighResImages(productId);
            await sleep(BLING_THROTTLE_MS);
          }
          const updated = await syncProductImages(dbProductId, hdImages, product.imagemURL);
          if (updated) imagesUpdated++;
        }

        synced++;
      } catch (e) {
        console.error('Error syncing product:', product.id, e);
        failed++;
      }
    }

    const nextPage = collected.length >= batchSize ? lastPageFetched : lastPageFetched + 1;
    const hasMore = collected.length >= batchSize;

    console.log(`Sync complete. Synced=${synced} Failed=${failed} Images=${imagesUpdated} HasMore=${hasMore} NextPage=${nextPage}`);

    return new Response(
      JSON.stringify({
        success: true,
        synced,
        failed,
        imagesUpdated,
        total: toProcess.length,
        hasMore,
        nextPage,
        lastPageFetched,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Product sync error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
