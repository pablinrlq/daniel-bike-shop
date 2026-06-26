import { Link } from 'react-router-dom';
import { useNavCategories } from '@/hooks/useProducts';
import { Bike, Wrench, ShoppingBag, Package, ArrowRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const categoryIcons: Record<string, typeof Bike> = {
  bicicletas: Bike,
  pecas: Wrench,
  acessorios: ShoppingBag,
};

// Fotos verificadas (carregam e mostram o assunto certo). A fixie laranja
// combina com a cor da marca. Se alguma URL cair um dia, o gradiente de fundo
// do card aparece no lugar (ver onError abaixo) — nunca fica "imagem quebrada".
const categoryImages: Record<string, string> = {
  bicicletas: 'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?w=800&q=70&auto=format',
  pecas: 'https://images.unsplash.com/photo-1534150034764-046bf225d3fa?w=800&q=70&auto=format',
  acessorios: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=800&q=70&auto=format',
};

const CATEGORY_IMAGE_FALLBACK =
  'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&q=70&auto=format';

const CategorySection = () => {
  const { data: categories, isLoading } = useNavCategories();

  if (isLoading) {
    return (
      <section className="py-16 bg-card">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-sm text-muted-foreground uppercase tracking-wider">Categorias</span>
            <h2 className="text-3xl md:text-4xl font-bold mt-2">Navegue por Categoria</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-card">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <span className="text-sm text-muted-foreground uppercase tracking-wider">Categorias</span>
          <h2 className="text-3xl md:text-4xl font-bold mt-2">Navegue por Categoria</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {categories.map((category, index) => {
            const IconComponent = categoryIcons[category.slug] || Package;
            const image = categoryImages[category.slug] || CATEGORY_IMAGE_FALLBACK;

            return (
              <Link
                key={category.id}
                to={`/produtos?categoria=${category.slug}`}
                className={cn(
                  "group relative h-60 sm:h-72 overflow-hidden border border-border hover:border-primary transition-all duration-300",
                  "bg-gradient-to-br from-primary/25 via-secondary to-secondary",
                  "animate-fade-in"
                )}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <img
                  src={image}
                  alt={category.name}
                  loading="lazy"
                  decoding="async"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent group-hover:via-background/70 transition-colors duration-300" />
                <div className="absolute bottom-0 left-0 right-0 p-6 transform group-hover:translate-y-0 transition-transform duration-300">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/10 group-hover:bg-primary/20 transition-colors duration-300">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <ArrowRight className="h-5 w-5 text-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                  </div>
                  <h3 className="text-xl font-bold group-hover:text-primary transition-colors duration-300">{category.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{category.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default CategorySection;
