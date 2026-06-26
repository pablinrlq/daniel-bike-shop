import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Bike, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { topCategoryByName } from '@/lib/productFallback';
import { isInCatalog } from '@/data/catalogAllowlist';

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
  is_main?: boolean;
}

const formatPrice = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const HeroSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Banners cadastrados no admin (opcional).
  const { data: adminBanners, isLoading } = useQuery({
    queryKey: ['active-banners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data as Banner[];
    },
  });

  // Bikes Oggi/Rava (com foto do Bling) pra usar como banner automático.
  const { data: bikeBanners } = useQuery({
    queryKey: ['hero-bikes'],
    queryFn: async (): Promise<Banner[]> => {
      const { data, error } = await supabase
        .from('products')
        .select(
          'sku, name, slug, price, promotional_price, product_images(image_url, is_primary, display_order)',
        )
        .eq('is_active', true)
        .gt('stock_quantity', 0)
        .or('name.ilike.%OGGI%,name.ilike.%RAVA%')
        .limit(12);
      if (error) throw error;

      type BikeRow = {
        sku: string | null;
        name: string;
        slug: string;
        price: number;
        promotional_price: number | null;
        product_images: { image_url: string; is_primary: boolean }[] | null;
      };
      const slides: Banner[] = [];
      for (const p of (data ?? []) as BikeRow[]) {
        // só bikes do catálogo (CSV) e que tenham foto de verdade
        if (!isInCatalog({ sku: p.sku, name: p.name })) continue;
        if (topCategoryByName(p.name).slug !== 'bicicletas') continue;
        const imgs = p.product_images ?? [];
        const img = imgs.find((i) => i.is_primary)?.image_url || imgs[0]?.image_url;
        if (!img) continue; // hero precisa de foto real
        const price = p.promotional_price || p.price;
        slides.push({
          id: p.slug,
          title: p.name,
          subtitle: price ? `A partir de ${formatPrice(price)}` : null,
          image_url: img,
          link_url: `/produto/${p.slug}`,
        });
        if (slides.length >= 5) break;
      }
      return slides;
    },
  });

  // Prioriza as bikes (pedido do lojista); cai nos banners do admin se não houver
  // bike com foto ainda (ex.: antes de rodar a sync completa do Bling).
  const displayBanners: Banner[] =
    bikeBanners && bikeBanners.length > 0 ? bikeBanners : adminBanners ?? [];

  const count = displayBanners.length;

  const goToSlide = useCallback(
    (index: number) => {
      if (isTransitioning || !count) return;
      setIsTransitioning(true);
      setCurrentIndex(index);
      setTimeout(() => setIsTransitioning(false), 500);
    },
    [isTransitioning, count],
  );

  const goToNext = useCallback(() => {
    if (!count) return;
    goToSlide((currentIndex + 1) % count);
  }, [currentIndex, count, goToSlide]);

  const goToPrev = useCallback(() => {
    if (!count) return;
    goToSlide((currentIndex - 1 + count) % count);
  }, [currentIndex, count, goToSlide]);

  // Auto-advance
  useEffect(() => {
    if (count <= 1) return;
    const timer = setInterval(goToNext, 5000);
    return () => clearInterval(timer);
  }, [count, goToNext]);

  // Se o número de slides mudar, garante índice válido.
  useEffect(() => {
    if (currentIndex >= count) setCurrentIndex(0);
  }, [count, currentIndex]);

  if (isLoading) {
    return (
      <section className="relative min-h-[80vh] flex items-center overflow-hidden">
        <Skeleton className="absolute inset-0" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <div className="flex gap-4">
              <Skeleton className="h-12 w-32" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  const currentBanner = displayBanners[currentIndex];
  const hasMultiple = count > 1;

  return (
    <section className="relative min-h-[80vh] flex items-center overflow-hidden">
      {/* Imagens de fundo com crossfade */}
      {displayBanners.map((banner, index) => (
        <div
          key={banner.id}
          className={cn(
            'absolute inset-0 transition-opacity duration-700 ease-in-out',
            index === currentIndex ? 'opacity-100' : 'opacity-0',
          )}
        >
          <img
            src={banner.image_url}
            alt={banner.title}
            className="w-full h-full object-cover"
            loading={index === 0 ? 'eager' : 'lazy'}
            fetchPriority={index === 0 ? 'high' : 'auto'}
            decoding="async"
          />
        </div>
      ))}

      {count === 0 && <div className="absolute inset-0 bg-muted" />}

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent z-[1]" />

      {/* Conteúdo */}
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-muted-foreground mb-4 animate-fade-in">
            <Bike className="h-5 w-5" />
            <span className="text-sm uppercase tracking-wider">Daniel Bike Shop</span>
          </div>

          <h1
            key={currentBanner?.id || 'default'}
            className="text-4xl md:text-6xl font-bold leading-tight mb-6 animate-fade-in"
          >
            {currentBanner?.title || (
              <>
                Sua jornada sobre
                <span className="block text-primary">duas rodas</span>
                começa aqui
              </>
            )}
          </h1>

          <p
            key={`subtitle-${currentBanner?.id || 'default'}`}
            className="text-lg text-muted-foreground mb-8 max-w-lg animate-fade-in"
          >
            {currentBanner?.subtitle ||
              'Bikes Oggi e Rava, peças e acessórios. Qualidade, performance e preço justo.'}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 animate-fade-in">
            <Link to={currentBanner?.link_url || '/produtos'}>
              <Button size="lg" className="gap-2 w-full sm:w-auto group">
                {currentBanner?.link_url?.startsWith('/produto/') ? 'Ver esta bike' : 'Ver Produtos'}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Controles do carrossel */}
      {hasMultiple && (
        <>
          <button
            onClick={goToPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-background/50 hover:bg-background/80 backdrop-blur-sm border border-border transition-all opacity-0 hover:opacity-100 focus:opacity-100"
            aria-label="Banner anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-background/50 hover:bg-background/80 backdrop-blur-sm border border-border transition-all opacity-0 hover:opacity-100 focus:opacity-100"
            aria-label="Próximo banner"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {displayBanners.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={cn(
                  'w-2 h-2 rounded-full transition-all duration-300',
                  index === currentIndex
                    ? 'bg-primary w-8'
                    : 'bg-muted-foreground/50 hover:bg-muted-foreground',
                )}
                aria-label={`Ir para banner ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default HeroSection;
