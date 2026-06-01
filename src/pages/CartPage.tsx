import { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import CouponInput, { AppliedCoupon } from '@/components/CouponInput';

const CartPage = () => {
  const { items, removeFromCart, updateQuantity, total, clearCart } = useCart();
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const shippingCost = total >= 299 ? 0 : 29.90;
  
  // Calculate discount
  const discountAmount = appliedCoupon
    ? appliedCoupon.discountType === 'percentage'
      ? (total * appliedCoupon.discountValue) / 100
      : Math.min(appliedCoupon.discountValue, total)
    : 0;

  const orderTotal = total - discountAmount + shippingCost;

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center py-16">
          <div className="text-center">
            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h1 className="text-2xl font-bold mb-2">Seu carrinho está vazio</h1>
            <p className="text-muted-foreground mb-6">Adicione alguns produtos incríveis!</p>
            <Link to="/produtos">
              <Button className="gap-2">
                Explorar Produtos
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold mb-8">Carrinho de Compras</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Items */}
            <div className="lg:col-span-2 space-y-4">
              {items.map(item => (
                <div key={item.product.id} className="flex gap-4 p-4 bg-card border border-border">
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    loading="lazy"
                    decoding="async"
                    className="w-24 h-24 object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{item.product.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatPrice(item.product.price)} cada
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        disabled={item.quantity >= item.product.stock}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => removeFromCart(item.product.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <span className="font-bold">
                      {formatPrice(item.product.price * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={clearCart} className="text-destructive">
                Limpar Carrinho
              </Button>
            </div>

            {/* Summary */}
            <div className="lg:col-span-1">
              <div className="bg-card border border-border p-6 sticky top-24 space-y-4">
                <h2 className="text-xl font-bold">Resumo do Pedido</h2>
                
                {/* Coupon Input */}
                <CouponInput
                  orderTotal={total}
                  appliedCoupon={appliedCoupon}
                  onApplyCoupon={setAppliedCoupon}
                />

                <div className="space-y-3 text-sm pt-4 border-t border-border">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-primary">
                      <span>Desconto ({appliedCoupon?.code})</span>
                      <span>-{formatPrice(discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Frete</span>
                    <span className={shippingCost === 0 ? 'text-primary' : ''}>
                      {shippingCost === 0 ? 'Grátis' : formatPrice(shippingCost)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-3 mt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>{formatPrice(orderTotal)}</span>
                    </div>
                    {total >= 299 && (
                      <p className="text-xs text-primary mt-1">Você ganhou frete grátis!</p>
                    )}
                  </div>
                </div>
                <Link to="/checkout" className="block">
                  <Button className="w-full gap-2" size="lg">
                    Finalizar Pedido
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/produtos" className="block text-center">
                  <Button variant="link" className="text-muted-foreground">
                    Continuar Comprando
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CartPage;
