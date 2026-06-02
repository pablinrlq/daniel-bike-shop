import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useAuth } from '@/contexts/AuthContext';
import { useMyOrders, MyOrder } from '@/hooks/useMyOrders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, PackageOpen, LogOut } from 'lucide-react';

const formatPrice = (price: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const statusLabel: Record<string, string> = {
  pending: 'Pendente',
  paid: 'Pago',
  shipped: 'Enviado',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

const statusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (status === 'paid' || status === 'delivered') return 'default';
  if (status === 'cancelled') return 'destructive';
  if (status === 'shipped') return 'secondary';
  return 'outline';
};

const OrderCard = ({ order }: { order: MyOrder }) => (
  <Card>
    <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
      <div>
        <CardTitle className="text-base font-mono">
          #{order.id.slice(0, 8).toUpperCase()}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">{formatDate(order.created_at)}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <Badge variant={statusVariant(order.status)}>
          {statusLabel[order.status] || order.status}
        </Badge>
        <Badge variant={statusVariant(order.payment_status)}>
          Pagamento: {statusLabel[order.payment_status] || order.payment_status}
        </Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      <ul className="space-y-1 text-sm">
        {order.items?.map((item) => (
          <li key={item.id} className="flex justify-between gap-4">
            <span className="text-muted-foreground truncate">
              {item.quantity}x {item.product_name}
            </span>
            <span className="font-medium">{formatPrice(Number(item.subtotal))}</span>
          </li>
        ))}
      </ul>
      <div className="border-t border-border pt-2 text-sm space-y-1">
        <div className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatPrice(Number(order.subtotal))}</span>
        </div>
        {Number(order.discount_amount) > 0 && (
          <div className="flex justify-between text-primary">
            <span>Desconto {order.coupon_code ? `(${order.coupon_code})` : ''}</span>
            <span>-{formatPrice(Number(order.discount_amount))}</span>
          </div>
        )}
        <div className="flex justify-between text-muted-foreground">
          <span>Frete</span>
          <span>
            {Number(order.shipping_cost) === 0 ? 'Grátis' : formatPrice(Number(order.shipping_cost))}
          </span>
        </div>
        <div className="flex justify-between font-bold pt-1">
          <span>Total</span>
          <span>{formatPrice(Number(order.total))}</span>
        </div>
      </div>
    </CardContent>
  </Card>
);

const AccountPage = () => {
  const { user, signOut, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data: orders, isLoading, isError } = useMyOrders();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login?next=/conta', { replace: true });
    }
  }, [user, authLoading, navigate]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const fullName = (user.user_metadata as { full_name?: string } | null)?.full_name;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main-content" className="flex-1 py-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-start justify-between mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold">Minha conta</h1>
              <p className="text-muted-foreground mt-1">
                {fullName ? `${fullName} — ` : ''}
                {user.email}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
            >
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>

          <h2 className="text-xl font-semibold mb-4">Meus pedidos</h2>

          {isLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {isError && (
            <p className="text-destructive text-sm">Erro ao carregar pedidos. Tente novamente.</p>
          )}

          {!isLoading && orders && orders.length === 0 && (
            <Card>
              <CardContent className="py-12 flex flex-col items-center text-center gap-4">
                <PackageOpen className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">Você ainda não fez nenhum pedido.</p>
                <Link to="/produtos">
                  <Button>Ver produtos</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {!isLoading && orders && orders.length > 0 && (
            <div className="space-y-4">
              {orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default AccountPage;
