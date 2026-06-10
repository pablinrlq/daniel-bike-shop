import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

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
  const primaryImage = dbProduct.images?.find(img => img.is_primary);
  const mainImage = primaryImage?.image_url || dbProduct.images?.[0]?.image_url || '/placeholder.svg';
  
  return {
    id: dbProduct.id,
    slug: dbProduct.slug,
    name: dbProduct.name,
    description: dbProduct.description || '',
    price: dbProduct.promotional_price || dbProduct.price,
    originalPrice: dbProduct.promotional_price ? dbProduct.price : undefined,
    promotionalPrice: dbProduct.promotional_price || undefined,
    category: dbProduct.category?.name || 'Sem categoria',
    categorySlug: dbProduct.category?.slug || 'outros',
    image: mainImage,
    primaryImage: mainImage,
    images: dbProduct.images?.sort((a, b) => a.display_order - b.display_order).map(img => img.image_url) || [mainImage],
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
        .gt('stock_quantity', 0)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data as DbProduct[]).map(transformProduct);
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
      return (data as DbProduct[]).map(transformProduct);
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
        .eq('is_active', true)
        .gt('stock_quantity', 0);

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
      return (data as DbProduct[]).map(transformProduct);
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
}

/**
 * Categorias para mostrar na navbar/footer.
 * Filtra: só categorias ativas que têm pelo menos 1 produto ativo com estoque.
 * Assim a nav nunca leva pra uma listagem vazia.
 */
export const useNavCategories = () => {
  return useQuery({
    queryKey: ['nav-categories'],
    queryFn: async (): Promise<NavCategory[]> => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug, products!inner(id)')
        .eq('is_active', true)
        .eq('products.is_active', true)
        .gt('products.stock_quantity', 0)
        .order('name');

      if (error) throw error;
      // O inner join devolve a categoria com array de produtos; só queremos a categoria.
      // E como uma categoria pode vir várias vezes, deduplica por id.
      const seen = new Set<string>();
      const result: NavCategory[] = [];
      for (const row of data ?? []) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        result.push({ id: row.id, name: row.name, slug: row.slug });
      }
      return result;
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });
};
