import { Product } from '@/hooks/useProducts';
import { Product as CartProduct } from '@/types/product';
import { Button } from '@/components/ui/button';
import { MessageCircle, Eye, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useCart } from '@/contexts/CartContext';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useAuth } from '@/contexts/AuthContext';
import WishlistButton from '@/components/WishlistButton';
import StockAlertButton from '@/components/StockAlertButton';
import ProductImage from '@/components/ProductImage';
import {
  buildProductMessage,
  buildWhatsappUrl,
  resolveWhatsappNumber,
  userToContact,
} from '@/lib/whatsapp';

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const { addToCart } = useCart();
  const { data: storeSettings } = useStoreSettings();
  const { user } = useAuth();

  const isOutOfStock = product.stock <= 0;
  const isStoreOpen = storeSettings?.is_store_open ?? true;
  const canPurchase = isStoreOpen && !isOutOfStock;

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

  const handleAddToCart = () => {
    if (!canPurchase) {
      toast.error(isStoreOpen ? 'Produto esgotado' : 'A loja está fechada no momento.');
      return;
    }
    const cartProduct: CartProduct = {
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
    };
    addToCart(cartProduct);
    toast.success(`${product.name} adicionado ao carrinho!`);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const discount = product.originalPrice 
    ? Math.round((1 - product.price / product.originalPrice) * 100) 
    : 0;

  return (
    <div className="group bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all duration-300 flex flex-col">
      {/* Imagem em fundo branco com object-contain pra nao cortar o produto */}
      <div className="relative aspect-square overflow-hidden bg-white">
        <ProductImage
          src={product.image}
          fallbacks={product.images}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500"
        />

        {/* Link cobrindo a imagem — no mobile (sem hover) é o que torna o card
            clicável; toca em qualquer lugar da foto e abre o produto. */}
        <Link
          to={`/produto/${product.slug || product.id}`}
          className="absolute inset-0 z-[1]"
          aria-label={`Ver ${product.name}`}
        />

        {/* Wishlist (canto superior direito) */}
        <div className="absolute top-2 right-2 z-10">
          <WishlistButton
            productId={product.id}
            productName={product.name}
            className="bg-white/90 hover:bg-white text-foreground shadow-sm"
          />
        </div>

        {/* Badges (canto superior esquerdo, empilhados, sem animacao) */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1 items-start">
          {discount > 0 && (
            <span className="bg-destructive text-destructive-foreground text-[11px] font-bold px-2 py-0.5 rounded shadow-sm">
              -{discount}%
            </span>
          )}
          {product.stock <= 3 && product.stock > 0 && (
            <span className="bg-amber-500 text-white text-[11px] font-semibold px-2 py-0.5 rounded shadow-sm">
              Últimas unidades
            </span>
          )}
        </div>

        {isOutOfStock && (
          <div className="absolute inset-0 z-[2] pointer-events-none bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
            <span className="bg-foreground/90 text-background font-semibold px-3 py-1 rounded text-sm uppercase tracking-wider">
              Esgotado
            </span>
          </div>
        )}
        {!isStoreOpen && !isOutOfStock && (
          <div className="absolute inset-0 z-[2] pointer-events-none bg-white/70 backdrop-blur-[1px] flex items-center justify-center">
            <span className="bg-foreground/90 text-background font-semibold px-3 py-1 rounded text-sm uppercase tracking-wider">
              Loja Fechada
            </span>
          </div>
        )}
        {/* Overlay com botoes — só no hover (desktop). pointer-events-none
            enquanto escondido pra não roubar o toque do link no mobile. */}
        <div className="absolute bottom-0 left-0 right-0 z-[2] p-3 bg-gradient-to-t from-black/70 via-black/40 to-transparent opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200">
          <div className="flex gap-2">
            <Link to={`/produto/${product.slug || product.id}`} className="flex-1">
              <Button variant="secondary" size="sm" className="w-full gap-1">
                <Eye className="h-4 w-4" />
                Ver
              </Button>
            </Link>
            <Button
              size="icon"
              variant="outline"
              onClick={handleAddToCart}
              disabled={!canPurchase}
              aria-label="Adicionar ao carrinho"
              title="Adicionar ao carrinho"
              className="shrink-0 bg-background"
            >
              <ShoppingCart className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={handleWhatsapp}
              disabled={!canPurchase}
              className="flex-1 gap-1 bg-[#25D366] hover:bg-[#20BA5A] text-white"
            >
              <MessageCircle className="h-4 w-4" />
              {isOutOfStock ? 'Esgotado' : 'Quero esse'}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
          {product.category}
        </span>
        <Link
          to={`/produto/${product.slug || product.id}`}
          className="font-semibold mt-1 line-clamp-2 leading-snug min-h-[2.6rem] hover:text-primary transition-colors"
        >
          <h3>{product.name}</h3>
        </Link>
        <div className="mt-auto pt-3 flex items-baseline gap-2 flex-wrap">
          <span className="text-lg font-bold text-primary">{formatPrice(product.price)}</span>
          {product.originalPrice && (
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(product.originalPrice)}
            </span>
          )}
        </div>

        {isOutOfStock && (
          <StockAlertButton
            productId={product.id}
            productName={product.name}
            className="w-full mt-3"
          />
        )}
      </div>
    </div>
  );
};

export default ProductCard;
