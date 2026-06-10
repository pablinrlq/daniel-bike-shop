import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BLING_API_BASE = 'https://www.bling.com.br/Api/v3';
const BLING_THROTTLE_MS = 350;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Formata data pro Bling: "YYYY-MM-DD HH:mm:ss" (no fuso UTC).
const formatBlingDate = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let syncStartedAt = new Date().toISOString();

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const BLING_CLIENT_ID = Deno.env.get('BLING_CLIENT_ID')!;
    const BLING_CLIENT_SECRET = Deno.env.get('BLING_CLIENT_SECRET')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const skipImageDetail = Boolean((body as { skipImageDetail?: boolean }).skipImageDetail);
    const startPage = Math.max(1, Number((body as { startPage?: number }).startPage) || 1);
    // mode: "incremental" (delta desde last_incremental_sync_at) ou "full" (tudo, ignora data).
    const mode = ((body as { mode?: string }).mode || 'incremental') as 'incremental' | 'full';

    // ---- Token Bling ----
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

    // ---- Estado de sync ----
    const { data: syncState } = await supabase
      .from('bling_sync_state')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    const lastIncremental = syncState?.last_incremental_sync_at ?? null;
    // Em incremental, manda dataAlteracaoInicial pra trazer só o delta.
    // Em full, ignora data e sincroniza tudo.
    const dataFilter =
      mode === 'incremental' && lastIncremental
        ? `&dataAlteracaoInicial=${encodeURIComponent(formatBlingDate(lastIncremental))}`
        : '';

    console.log(`Sync mode=${mode} startPage=${startPage} skipImageDetail=${skipImageDetail} lastIncremental=${lastIncremental ?? 'never'}`);

    // ---- Helpers ----
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
        return Array.from(new Set([...externas, ...internas]));
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

    // ---- Listagem: uma página por execução ----
    // Bling devolve 100 produtos por página. Processamos uma página por chamada
    // pra ficar embaixo do timeout do edge runtime; o front faz o loop entre páginas.
    const response = await blingFetch(`/produtos?pagina=${startPage}&limite=100${dataFilter}`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bling API error (pagina ${startPage}): ${response.status} - ${errorText}`);
    }
    const result = await response.json();
    const toProcess = (result?.data ?? []) as any[];
    const lastPageFetched = startPage;

    // CAMINHO RÁPIDO: incremental e nada mudou.
    if (mode === 'incremental' && startPage === 1 && toProcess.length === 0) {
      await supabase
        .from('bling_sync_state')
        .update({
          last_incremental_sync_at: syncStartedAt,
          last_sync_status: 'up_to_date',
          last_sync_synced_count: 0,
          last_sync_failed_count: 0,
          last_sync_images_count: 0,
          last_sync_error: null,
        })
        .eq('id', 1);

      console.log('Up to date — nothing changed in Bling since last sync.');
      return new Response(
        JSON.stringify({
          success: true,
          upToDate: true,
          synced: 0,
          failed: 0,
          imagesUpdated: 0,
          total: 0,
          hasMore: false,
          nextPage: 1,
          lastPageFetched: 0,
          message: 'Catálogo já está sincronizado.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
      );
    }

    console.log(`startPage=${startPage} fetched=${toProcess.length}`);

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
        let isNew = false;
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
          isNew = true;
        }

        if (dbProductId) {
          // Em incremental, só re-fetch HD images se for produto novo OU se nao tem imagem ainda.
          // Em full, sempre re-fetch (re-baixa tudo).
          let needsImageRefresh = mode === 'full' || isNew;
          if (!needsImageRefresh) {
            const { count } = await supabase
              .from('product_images')
              .select('id', { count: 'exact', head: true })
              .eq('product_id', dbProductId);
            needsImageRefresh = (count ?? 0) === 0;
          }

          if (needsImageRefresh) {
            let hdImages: string[] = [];
            if (!skipImageDetail) {
              hdImages = await fetchHighResImages(productId);
              await sleep(BLING_THROTTLE_MS);
            }
            const updated = await syncProductImages(dbProductId, hdImages, product.imagemURL);
            if (updated) imagesUpdated++;
          }
        }

        synced++;
      } catch (e) {
        console.error('Error syncing product:', product.id, e);
        failed++;
      }
    }

    // Página cheia (100) = provavelmente tem mais. Página parcial = fim.
    const hasMore = toProcess.length === 100;
    const nextPage = lastPageFetched + 1;

    // Se já é o último lote, persiste o timestamp pra próxima incremental
    if (!hasMore) {
      const update: Record<string, unknown> = {
        last_incremental_sync_at: syncStartedAt,
        last_sync_status: failed === 0 ? 'ok' : 'partial',
        last_sync_synced_count: synced,
        last_sync_failed_count: failed,
        last_sync_images_count: imagesUpdated,
        last_sync_error: null,
      };
      if (mode === 'full') {
        update.last_full_sync_at = syncStartedAt;
      }
      await supabase.from('bling_sync_state').update(update).eq('id', 1);
    }

    return new Response(
      JSON.stringify({
        success: true,
        upToDate: false,
        synced,
        failed,
        imagesUpdated,
        total: toProcess.length,
        hasMore,
        nextPage,
        lastPageFetched,
        mode,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Product sync error:', error);
    // Registra o erro na tabela de estado
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      await supabase
        .from('bling_sync_state')
        .update({
          last_sync_status: 'error',
          last_sync_error: error instanceof Error ? error.message : String(error),
        })
        .eq('id', 1);
    } catch {
      // ignore
    }
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
