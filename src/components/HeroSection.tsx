import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Bike, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
  is_main: boolean;
}

const HeroSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const { data: banners, isLoading } = useQuery({
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

  const goToSlide = useCallback((index: number) => {
    if (isTransitioning || !banners?.length) return;
    setIsTransitioning(true);
    setCurrentIndex(index);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning, banners?.length]);

  const goToNext = useCallback(() => {
    if (!banners?.length) return;
    const nextIndex = (currentIndex + 1) % banners.length;
    goToSlide(nextIndex);
  }, [currentIndex, banners?.length, goToSlide]);

  const goToPrev = useCallback(() => {
    if (!banners?.length) return;
    const prevIndex = (currentIndex - 1 + banners.length) % banners.length;
    goToSlide(prevIndex);
  }, [currentIndex, banners?.length, goToSlide]);

  // Auto-advance carousel
  useEffect(() => {
    if (!banners || banners.length <= 1) return;
    const timer = setInterval(goToNext, 5000);
    return () => clearInterval(timer);
  }, [banners, goToNext]);

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
              <Skeleton className="h-12 w-32" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  const currentBanner = banners?.[currentIndex];
  const hasMultipleBanners = banners && banners.length > 1;

  return (
    <section className="relative min-h-[80vh] flex items-center overflow-hidden">
      {/* Background Images with Crossfade */}
      {banners?.map((banner, index) => (
        <div
          key={banner.id}
          className={cn(
            "absolute inset-0 transition-opacity duration-700 ease-in-out",
            index === currentIndex ? "opacity-100" : "opacity-0"
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
      
      {/* Fallback if no banners */}
      {(!banners || banners.length === 0) && (
        <div className="absolute inset-0 bg-muted" />
      )}
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent z-[1]" />

      {/* Content */}
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
          
          {currentBanner?.subtitle && (
            <p 
              key={`subtitle-${currentBanner.id}`}
              className="text-lg text-muted-foreground mb-8 max-w-lg animate-fade-in"
            >
              {currentBanner.subtitle}
            </p>
          )}
          {!currentBanner?.subtitle && (
            <p className="text-lg text-muted-foreground mb-8 max-w-lg animate-fade-in">
              Encontre as melhores bicicletas e peças para todas as suas aventuras. 
              Qualidade, performance e preço justo.
            </p>
          )}
          
          <div className="flex flex-col sm:flex-row gap-4 animate-fade-in">
            <Link to={currentBanner?.link_url || '/produtos'}>
              <Button size="lg" className="gap-2 w-full sm:w-auto group">
                Ver Produtos
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link to="/produtos?categoria=bicicletas">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Bicicletas
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Carousel Controls */}
      {hasMultipleBanners && (
        <>
          {/* Navigation Arrows */}
          <button
            onClick={goToPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-background/50 hover:bg-background/80 backdrop-blur-sm border border-border transition-all opacity-0 hover:opacity-100 focus:opacity-100 group"
            aria-label="Banner anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-background/50 hover:bg-background/80 backdrop-blur-sm border border-border transition-all opacity-0 hover:opacity-100 focus:opacity-100 group"
            aria-label="Próximo banner"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all duration-300",
                  index === currentIndex 
                    ? "bg-primary w-8" 
                    : "bg-muted-foreground/50 hover:bg-muted-foreground"
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
