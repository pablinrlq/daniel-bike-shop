import { useSearchParams } from 'react-router-dom';
import { useState, useMemo } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { useProducts, useCategories } from '@/hooks/useProducts';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import SEO from '@/components/SEO';

const ProductsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('categoria') || 'todos';
  const searchQuery = searchParams.get('busca') || '';
  const [sortBy, setSortBy] = useState('featured');

  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: categories, isLoading: categoriesLoading } = useCategories();

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    let filtered = categoryParam === 'todos' 
      ? products 
      : products.filter(p => p.categorySlug === categoryParam);

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.brand?.toLowerCase().includes(query) ||
        p.model?.toLowerCase().includes(query)
      );
    }

    switch (sortBy) {
      case 'price-asc':
        return [...filtered].sort((a, b) => a.price - b.price);
      case 'price-desc':
        return [...filtered].sort((a, b) => b.price - a.price);
      case 'name':
        return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
      default:
        return filtered;
    }
  }, [products, categoryParam, searchQuery, sortBy]);

  const categoryOptions = useMemo(() => {
    const options = [{ value: 'todos', label: 'Todos' }];
    if (categories) {
      categories.forEach(cat => {
        options.push({ value: cat.slug, label: cat.name });
      });
    }
    return options;
  }, [categories]);

  const handleCategoryChange = (category: string) => {
    if (category === 'todos') {
      searchParams.delete('categoria');
    } else {
      searchParams.set('categoria', category);
    }
    setSearchParams(searchParams);
  };

  const isLoading = productsLoading || categoriesLoading;

  const pageTitle = categoryParam !== 'todos'
    ? `${categoryOptions.find((c) => c.value === categoryParam)?.label || 'Produtos'}`
    : 'Produtos';

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title={pageTitle}
        description="Catálogo completo de bicicletas, peças e acessórios. Filtros por categoria e ordenação por preço."
        canonical={`https://ride-sell.vercel.app/produtos${categoryParam !== 'todos' ? `?categoria=${categoryParam}` : ''}`}
      />
      <Header />
      <main id="main-content" className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold">Nossos Produtos</h1>
            <p className="text-muted-foreground mt-2">
              {isLoading ? (
                <Skeleton className="h-5 w-40 inline-block" />
              ) : (
                `${filteredProducts.length} produto${filteredProducts.length !== 1 ? 's' : ''} encontrado${filteredProducts.length !== 1 ? 's' : ''}`
              )}
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-8 p-4 bg-card border border-border">
            <div className="flex flex-wrap gap-2">
              {isLoading ? (
                <>
                  <Skeleton className="h-9 w-20" />
                  <Skeleton className="h-9 w-24" />
                  <Skeleton className="h-9 w-20" />
                </>
              ) : (
                categoryOptions.map(cat => (
                  <Button
                    key={cat.value}
                    variant={categoryParam === cat.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleCategoryChange(cat.value)}
                  >
                    {cat.label}
                  </Button>
                ))
              )}
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Destaque</SelectItem>
                <SelectItem value="price-asc">Menor preço</SelectItem>
                <SelectItem value="price-desc">Maior preço</SelectItem>
                <SelectItem value="name">Nome A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Products Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="bg-card border border-border overflow-hidden">
                  <Skeleton className="aspect-square" />
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {!isLoading && filteredProducts.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">Nenhum produto encontrado nesta categoria.</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProductsPage;
