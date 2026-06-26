import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { fallbackImageFor, categorizeByName, topCategoryByName, TOP_CATEGORIES } from '@/lib/productFallback';
import { isInCatalog } from '@/data/catalogAllowlist';
import { overrideImageForSku } from '@/lib/productImageOverrides';

export type DbProduct = Tables<'products'> & {
  category: Tables<'categories'> | null;
  images: Tables<'product_images'>[];
};

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  promotionalPrice?: number;
  category: string;
  categorySlug: string;
  image: string;
  primaryImage: string;
  images: string[];
  stock: number;
  featured: boolean;
  brand?: string;
  model?: string;
  aro?: string;
  marchas?: string;
  suspensao?: string;
  materialQuadro?: string;
  tamanhoQuadro?: string;
}

const transformProduct = (dbProduct: DbProduct): Product => {
  const hasOwnImage = (dbProduct.images?.length ?? 0) > 0;
  // Sem foto do Bling: 1º tenta a foto OFICIAL curada por SKU; senão cai na
  // foto/plaquinha da categoria, inferida pelo nome. Nunca quebra.
  const fallback = overrideImageForSku(dbProduct.sku) ?? fallbackImageFor(dbProduct.name);
  const primaryImage = dbProduct.images?.find(img => img.is_primary);
  const mainImage = primaryImage?.image_url || dbProduct.images?.[0]?.image_url || fallback;
  // Sem categoria no banco? Usa a categoria inferida pelo nome ("Quadro",
  // "Pneu"...) no lugar de "Sem categoria".
  const categoryLabel = dbProduct.category?.name || categorizeByName(dbProduct.name).label;
  // O SLUG (usado no filtro e na nav) precisa ser uma categoria de TOPO. Como o
  // Bling não preenche a categoria, inferimos pelo nome — assim o filtro por
  // categoria funciona em vez de jogar tudo em "outros".
  const categorySlug = dbProduct.category?.slug || topCategoryByName(dbProduct.name).slug;

  return {
    id: dbProduct.id,
    slug: dbProduct.slug,
    name: dbProduct.name,
    description: dbProduct.description || '',
    price: dbProduct.promotional_price || dbProduct.price,
    originalPrice: dbProduct.promotional_price ? dbProduct.price : undefined,
    promotionalPrice: dbProduct.promotional_price || undefined,
    category: categoryLabel,
    categorySlug,
    image: mainImage,
    primaryImage: mainImage,
    images: hasOwnImage
      ? dbProduct.images.sort((a, b) => a.display_order - b.display_order).map(img => img.image_url)
      : [mainImage],
    stock: dbProduct.stock_quantity,
    featured: dbProduct.is_featured,
    brand: dbProduct.brand || undefined,
    model: dbProduct.model || undefined,
    aro: dbProduct.aro || undefined,
    marchas: dbProduct.marchas || undefined,
    suspensao: dbProduct.suspensao || undefined,
    materialQuadro: dbProduct.material_quadro || undefined,
    tamanhoQuadro: dbProduct.tamanho_quadro || undefined,
  };
};

export const useProducts = () => {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*),
          images:product_images(*)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Só produtos do catálogo (CSV do Bling). Mostra também os esgotados,
      // pra permitir o "avise-me quando chegar".
      return (data as DbProduct[])
        .filter((d) => isInCatalog({ sku: d.sku, name: d.name }))
        .map(transformProduct);
    },
  });
};

export const useFeaturedProducts = () => {
  return useQuery({
    queryKey: ['products', 'featured'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*),
          images:product_images(*)
        `)
        .eq('is_active', true)
        .eq('is_featured', true)
        .gt('stock_quantity', 0)
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;
      return (data as DbProduct[])
        .filter((d) => isInCatalog({ sku: d.sku, name: d.name }))
        .map(transformProduct);
    },
  });
};

export const useProductsByCategory = (categorySlug: string) => {
  return useQuery({
    queryKey: ['products', 'category', categorySlug],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          *,
          category:categories(*),
          images:product_images(*)
        `)
        .eq('is_active', true);

      if (categorySlug && categorySlug !== 'todos') {
        const { data: category } = await supabase
          .from('categories')
          .select('id')
          .eq('slug', categorySlug)
          .single();
        
        if (category) {
          query = query.eq('category_id', category.id);
        }
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      return (data as DbProduct[])
        .filter((d) => isInCatalog({ sku: d.sku, name: d.name }))
        .map(transformProduct);
    },
  });
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Aceita UUID (id) OU slug. ProductCard linka por slug; rotas antigas com UUID continuam funcionando.
export const useProduct = (idOrSlug: string) => {
  return useQuery({
    queryKey: ['products', idOrSlug],
    queryFn: async () => {
      const column = UUID_RE.test(idOrSlug) ? 'id' : 'slug';
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*),
          images:product_images(*)
        `)
        .eq(column, idOrSlug)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('not_found');
      return transformProduct(data as DbProduct);
    },
    enabled: !!idOrSlug,
  });
};

export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
  });
};

export interface NavCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

/**
 * Categorias para mostrar na navbar/home/footer.
 * Lista só as categorias (de topo) que têm pelo menos 1 produto ativo em estoque.
 * Como o Bling não preenche a categoria no banco, a categoria é INFERIDA pelo
 * nome do produto — assim a nav nunca leva pra uma listagem vazia e o catálogo
 * fica organizado automaticamente.
 */
export const useNavCategories = () => {
  return useQuery({
    queryKey: ['nav-categories'],
    queryFn: async (): Promise<NavCategory[]> => {
      const { data, error } = await supabase
        .from('products')
        .select('sku, name, category:categories(name, slug)')
        .eq('is_active', true);

      if (error) throw error;

      const seen = new Map<string, NavCategory>();
      for (const row of (data ?? []) as { sku: string | null; name: string; category: { name: string; slug: string } | null }[]) {
        if (!isInCatalog({ sku: row.sku, name: row.name })) continue;
        const slug = row.category?.slug || topCategoryByName(row.name).slug;
        const name = row.category?.name || topCategoryByName(row.name).label;
        if (!seen.has(slug)) seen.set(slug, { id: slug, name, slug });
      }

      // Ordena pelas categorias de topo conhecidas; o resto vai pro fim.
      const order = TOP_CATEGORIES.map((c) => c.slug);
      return [...seen.values()].sort((a, b) => {
        const ia = order.indexOf(a.slug);
        const ib = order.indexOf(b.slug);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      });
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });
};
