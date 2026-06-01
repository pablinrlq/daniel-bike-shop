import { Product } from '@/hooks/useProducts';
import { Product as CartProduct } from '@/types/product';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import { ShoppingCart, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import WishlistButton from '@/components/WishlistButton';

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  const { addToCart } = useCart();
  const { data: storeSettings } = useStoreSettings();

  const isOutOfStock = product.stock <= 0;
  const isStoreOpen = storeSettings?.is_store_open ?? true;
  const canPurchase = isStoreOpen && !isOutOfStock;

  const handleAddToCart = () => {
    if (!canPurchase) {
      if (!isStoreOpen) {
        toast.error('A loja está fechada no momento.');
      } else {
        toast.error('Produto esgotado');
      }
      return;
    }

    const cartProduct: CartProduct = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      originalPrice: product.originalPrice,
      category: product.categorySlug as 'bicicletas' | 'pecas' | 'acessorios',
      image: product.image,
      stock: product.stock,
      featured: product.featured,
      slug: product.slug,
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
    <div className="group bg-card border border-border overflow-hidden hover:border-primary/50 transition-all duration-300">
      <div className="relative aspect-square overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {/* Wishlist button */}
        <div className="absolute top-2 right-2 z-10">
          <WishlistButton 
            productId={product.id} 
            productName={product.name}
            className="bg-background/80 hover:bg-background"
          />
        </div>
        {discount > 0 && (
          <span className="absolute top-3 left-3 bg-destructive text-destructive-foreground text-xs font-bold px-2 py-1">
            -{discount}%
          </span>
        )}
        {product.stock <= 3 && product.stock > 0 && (
          <span className="absolute top-12 left-3 bg-secondary text-secondary-foreground text-xs font-bold px-2 py-1">
            Últimas unidades
          </span>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <span className="text-destructive font-semibold text-lg">Esgotado</span>
          </div>
        )}
        {!isStoreOpen && !isOutOfStock && (
          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
            <span className="text-muted-foreground font-semibold">Loja Fechada</span>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-background/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex gap-2">
            <Link to={`/produto/${product.slug || product.id}`} className="flex-1">
              <Button variant="secondary" size="sm" className="w-full gap-1">
                <Eye className="h-4 w-4" />
                Ver
              </Button>
            </Link>
            <Button 
              size="sm" 
              onClick={handleAddToCart}
              disabled={!canPurchase}
              className="flex-1 gap-1"
            >
              <ShoppingCart className="h-4 w-4" />
              {isOutOfStock ? 'Esgotado' : 'Comprar'}
            </Button>
          </div>
        </div>
      </div>
      <div className="p-4">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">
          {product.category}
        </span>
        <h3 className="font-semibold mt-1 line-clamp-1">{product.name}</h3>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-bold text-primary">{formatPrice(product.price)}</span>
          {product.originalPrice && (
            <span className="text-sm text-muted-foreground line-through">
              {formatPrice(product.originalPrice)}
            </span>
          )}
        </div>
        {isOutOfStock && (
          <p className="text-xs text-destructive mt-2 font-medium">Produto esgotado</p>
        )}
      </div>
    </div>
  );
};

export default ProductCard;
