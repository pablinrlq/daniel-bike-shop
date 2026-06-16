import { useParams, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useProduct, useProducts } from '@/hooks/useProducts';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { ShoppingCart, MessageCircle, ArrowLeft, Truck, Shield, RotateCcw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import ProductCard from '@/components/ProductCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState } from 'react';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import WishlistButton from '@/components/WishlistButton';
import ProductReviews from '@/components/ProductReviews';
import ProductImage from '@/components/ProductImage';
import SEO from '@/components/SEO';
import {
  buildProductMessage,
  buildWhatsappUrl,
  resolveWhatsappNumber,
  userToContact,
} from '@/lib/whatsapp';

const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined) || 'https://danielbikeshop.com';

const ProductDetailPage = () => {
  const { id } = useParams();
  const { data: product, isLoading, error } = useProduct(id || '');
  const { data: allProducts } = useProducts();
  const { addToCart } = useCart();
  const { data: storeSettings } = useStoreSettings();
  const { user } = useAuth();
  const [selectedImage, setSelectedImage] = useState(0);

  const isOutOfStock = product ? product.stock <= 0 : false;
  const isStoreOpen = storeSettings?.is_store_open ?? true;
  const canPurchase = isStoreOpen && !isOutOfStock;

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-8">
          <div className="container mx-auto px-4">
            <Skeleton className="h-6 w-40 mb-8" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <Skeleton className="aspect-square" />
              <div className="space-y-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-10 w-3/4" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-12 w-48" />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Produto não encontrado</h1>
            <Link to="/produtos">
              <Button>Voltar para produtos</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const handleAddToCart = () => {
    if (!canPurchase) {
      if (!isStoreOpen) {
        toast.error('A loja está fechada no momento.');
      } else {
        toast.error('Produto esgotado');
      }
      return;
    }

    addToCart({
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      price: product.price,
      originalPrice: product.originalPrice,
      category: product.categorySlug as 'bicicletas' | 'pecas' | 'acessorios',
      image: product.image,
      stock: product.stock,
      featured: product.featured,
    });
    toast.success(`${product.name} adicionado ao carrinho!`);
  };

  const handleWhatsapp = () => {
    if (!canPurchase) {
      toast.error(isStoreOpen ? 'Produto esgotado' : 'A loja está fechada no momento.');
      return;
    }
    const number = resolveWhatsappNumber(storeSettings?.whatsapp);
    const message = buildProductMessage(
      { id: product.id, slug: product.slug, name: product.name, price: product.price },
      userToContact(user),
    );
    window.open(buildWhatsappUrl(number, message), '_blank', 'noopener,noreferrer');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const relatedProducts = allProducts
    ?.filter(p => p.categorySlug === product.categorySlug && p.id !== product.id)
    .slice(0, 3) || [];

  const discount = product.originalPrice 
    ? Math.round((1 - product.price / product.originalPrice) * 100) 
    : 0;

  const images = product.images.length > 0 ? product.images : [product.image];

  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title={product.name}
        description={product.description?.slice(0, 160) || `${product.name} — Daniel Bike Shop`}
        canonical={`${SITE_URL}/produto/${product.slug || product.id}`}
      />
      <ProductJsonLd product={product} />
      <Header />
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <Link to="/produtos" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary mb-8">
            <ArrowLeft className="h-4 w-4" />
            Voltar para produtos
          </Link>

          {!isStoreOpen && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                A loja está fechada no momento. Não é possível realizar compras.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Images */}
            <div className="space-y-4">
              <div className="relative aspect-square bg-card border border-border overflow-hidden">
                <ProductImage
                  src={images[selectedImage]}
                  fallbacks={images}
                  alt={product.name}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
                {discount > 0 && (
                  <span className="absolute top-4 left-4 bg-destructive text-destructive-foreground text-sm font-bold px-3 py-1">
                    -{discount}%
                  </span>
                )}
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                    <span className="text-destructive text-2xl font-bold">ESGOTADO</span>
                  </div>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto">
                  {images.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`flex-shrink-0 w-20 h-20 border overflow-hidden transition-all bg-muted ${
                        selectedImage === index
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <ProductImage src={img} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div>
              <span className="text-sm text-muted-foreground uppercase tracking-wider">
                {product.category}
              </span>
              <h1 className="text-3xl md:text-4xl font-bold mt-2">{product.name}</h1>
              
              {(product.brand || product.model) && (
                <p className="text-muted-foreground mt-2">
                  {product.brand} {product.model && `- ${product.model}`}
                </p>
              )}
              
              <div className="mt-6 flex items-baseline gap-3">
                <span className="text-3xl font-bold text-primary">{formatPrice(product.price)}</span>
                {product.originalPrice && (
                  <span className="text-lg text-muted-foreground line-through">
                    {formatPrice(product.originalPrice)}
                  </span>
                )}
              </div>

              <p className="text-muted-foreground mt-6 leading-relaxed">{product.description}</p>

              {/* Specs */}
              {(product.aro || product.marchas || product.suspensao || product.materialQuadro || product.tamanhoQuadro) && (
                <div className="mt-6 p-4 bg-muted/50 rounded-lg space-y-2">
                  <h3 className="font-semibold text-sm">Especificações:</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {product.aro && (
                      <div><span className="text-muted-foreground">Aro:</span> {product.aro}</div>
                    )}
                    {product.marchas && (
                      <div><span className="text-muted-foreground">Marchas:</span> {product.marchas}</div>
                    )}
                    {product.suspensao && (
                      <div><span className="text-muted-foreground">Suspensão:</span> {product.suspensao}</div>
                    )}
                    {product.materialQuadro && (
                      <div><span className="text-muted-foreground">Material:</span> {product.materialQuadro}</div>
                    )}
                    {product.tamanhoQuadro && (
                      <div><span className="text-muted-foreground">Tamanho:</span> {product.tamanhoQuadro}</div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6">
                {isOutOfStock ? (
                  <span className="text-destructive font-semibold text-lg">
                    Produto esgotado
                  </span>
                ) : (
                  <span className={`text-sm ${product.stock > 5 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {product.stock > 5 
                      ? `${product.stock} em estoque` 
                      : `Apenas ${product.stock} em estoque`}
                  </span>
                )}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  onClick={handleWhatsapp}
                  disabled={!canPurchase}
                  className="gap-2 bg-[#25D366] hover:bg-[#20BA5A] text-white"
                >
                  <MessageCircle className="h-5 w-5" />
                  {isOutOfStock ? 'Produto Esgotado' : !isStoreOpen ? 'Loja Fechada' : 'Quero esse pelo WhatsApp'}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleAddToCart}
                  disabled={!canPurchase}
                  className="gap-2"
                >
                  <ShoppingCart className="h-5 w-5" />
                  Carrinho
                </Button>
                <WishlistButton
                  productId={product.id}
                  productName={product.name}
                  variant="full"
                />
              </div>

              {/* Features */}
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 border-t border-border">
                <div className="flex items-center gap-3">
                  <Truck className="h-5 w-5 text-primary" />
                  <span className="text-sm">Frete grátis acima de R$299</span>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-primary" />
                  <span className="text-sm">Garantia de 12 meses</span>
                </div>
                <div className="flex items-center gap-3">
                  <RotateCcw className="h-5 w-5 text-primary" />
                  <span className="text-sm">7 dias para troca</span>
                </div>
              </div>
            </div>
          </div>

          {/* Product Reviews */}
          <ProductReviews productId={product.id} productName={product.name} />

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <section className="mt-16 pt-16 border-t border-border">
              <h2 className="text-2xl font-bold mb-8">Produtos Relacionados</h2>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                {relatedProducts.map(p => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

/**
 * Injeta JSON-LD do tipo Product no <head> para rich snippets do Google.
 * Schema.org/Product — preço, disponibilidade, imagens, marca.
 */
const ProductJsonLd = ({ product }: { product: any }) => {
  useEffect(() => {
    const id = `jsonld-product-${product.id}`;
    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = id;
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: product.name,
      description: product.description,
      // Só fotos reais do produto no schema.org — fora as ilustrativas de
      // fallback (plaquinha em data URI ou foto de categoria em /categorias).
      image: (product.images || [product.image]).filter(
        (src: string) => src && !src.startsWith('data:') && !src.startsWith('/categorias/'),
      ),
      sku: product.id,
      brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
      offers: {
        '@type': 'Offer',
        priceCurrency: 'BRL',
        price: product.price,
        availability:
          product.stock > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        url: `${SITE_URL}/produto/${product.slug || product.id}`,
      },
    });
    return () => {
      script?.remove();
    };
  }, [product]);

  return null;
};

export default ProductDetailPage;
