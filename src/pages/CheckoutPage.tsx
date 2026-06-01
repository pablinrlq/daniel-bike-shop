import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useCart } from '@/contexts/CartContext';
import { useCreateOrder } from '@/hooks/useOrders';
import { useValidateStock } from '@/hooks/useStockValidation';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, CheckCircle, Loader2, MessageCircle, FileText, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

const WHATSAPP_NUMBER = '5531995326386';

interface OrderResult {
  id: string;
  blingOrderId?: string;
  blingOrderNumber?: string;
  nfeIssued?: boolean;
  nfeNumber?: string;
}

const CheckoutPage = () => {
  const { items, total, clearCart } = useCart();
  const navigate = useNavigate();
  const createOrder = useCreateOrder();
  const validateStock = useValidateStock();
  const { data: storeSettings, isLoading: isLoadingSettings } = useStoreSettings();
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);
  const [isValidatingStock, setIsValidatingStock] = useState(false);

  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_address: '',
    customer_city: '',
    customer_state: '',
    customer_zip: '',
    notes: '',
  });

  const shippingCost = total >= 299 ? 0 : 29.90;
  const orderTotal = total + shippingCost;

  const isStoreOpen = storeSettings?.is_store_open ?? true;

  // Validate stock on page load
  useEffect(() => {
    const validateOnLoad = async () => {
      if (items.length === 0) return;
      
      setIsValidatingStock(true);
      try {
        const result = await validateStock.mutateAsync(
          items.map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
          }))
        );

        if (!result.valid) {
          if (result.error === 'store_closed') {
            setStockError(result.message || 'A loja está fechada no momento.');
          } else if (result.results) {
            const invalidItems = result.results.filter(r => !r.valid);
            const messages = invalidItems.map(r => r.message).join('; ');
            setStockError(messages);
          }
        }
      } catch (error) {
        console.error('Stock validation error:', error);
      } finally {
        setIsValidatingStock(false);
      }
    };

    validateOnLoad();
  }, [items]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const generateWhatsAppMessage = (result: OrderResult) => {
    const orderNumber = result.blingOrderNumber || result.id.slice(0, 8).toUpperCase();
    
    let message = `🚲 *PEDIDO CONFIRMADO - DANIEL BIKE SHOP*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `📋 *Pedido:* #${orderNumber}\n`;
    message += `👤 *Cliente:* ${formData.customer_name}\n`;
    message += `📧 *E-mail:* ${formData.customer_email}\n`;
    message += `📱 *Telefone:* ${formData.customer_phone}\n\n`;
    
    message += `📍 *Endereço de Entrega:*\n`;
    message += `${formData.customer_address}\n`;
    message += `${formData.customer_city} - ${formData.customer_state}\n`;
    message += `CEP: ${formData.customer_zip}\n\n`;
    
    message += `📦 *PRODUTOS:*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    items.forEach((item, index) => {
      message += `${index + 1}. *${item.product.name}*\n`;
      message += `   ${item.quantity}x ${formatPrice(item.product.price)} = ${formatPrice(item.product.price * item.quantity)}\n`;
    });
    
    message += `\n━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `💰 *RESUMO:*\n`;
    message += `   Subtotal: ${formatPrice(total)}\n`;
    message += `   Frete: ${shippingCost === 0 ? 'GRÁTIS 🎉' : formatPrice(shippingCost)}\n`;
    message += `   *TOTAL: ${formatPrice(orderTotal)}*\n\n`;
    
    if (result.nfeIssued && result.nfeNumber) {
      message += `✅ *NF-e emitida:* ${result.nfeNumber}\n\n`;
    }
    
    if (formData.notes) {
      message += `📝 *Observações:* ${formData.notes}\n\n`;
    }
    
    message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `_Aguardando confirmação de pagamento_`;
    
    return encodeURIComponent(message);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStockError(null);

    // Final stock validation before order creation
    setIsValidatingStock(true);
    try {
      const stockResult = await validateStock.mutateAsync(
        items.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
        }))
      );

      if (!stockResult.valid) {
        if (stockResult.error === 'store_closed') {
          setStockError(stockResult.message || 'A loja está fechada no momento.');
          toast.error('A loja está fechada no momento.');
        } else if (stockResult.results) {
          const invalidItems = stockResult.results.filter(r => !r.valid);
          const messages = invalidItems.map(r => r.message).join('; ');
          setStockError(messages);
          toast.error('Alguns produtos estão indisponíveis');
        }
        setIsValidatingStock(false);
        return;
      }
    } catch (error: any) {
      console.error('Stock validation error:', error);
      setStockError('Erro ao validar estoque. Tente novamente.');
      setIsValidatingStock(false);
      return;
    }
    setIsValidatingStock(false);

    const orderItems = items.map(item => ({
      product_id: item.product.id,
      product_name: item.product.name,
      product_price: item.product.price,
      quantity: item.quantity,
      subtotal: item.product.price * item.quantity,
    }));

    try {
      const order = await createOrder.mutateAsync({
        ...formData,
        subtotal: total,
        shipping_cost: shippingCost,
        total: orderTotal,
        items: orderItems,
      });

      setOrderResult(order as OrderResult);
      setOrderComplete(true);
      clearCart();
    } catch (error: any) {
      console.error('Erro ao criar pedido:', error);
      toast.error(error.message || 'Erro ao criar pedido');
    }
  };

  const getWhatsAppLink = () => {
    if (!orderResult) return null;
    const message = generateWhatsAppMessage(orderResult);
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
  };

  useEffect(() => {
    if (items.length === 0 && !orderComplete) {
      navigate('/carrinho', { replace: true });
    }
  }, [items.length, orderComplete, navigate]);

  if (items.length === 0 && !orderComplete) {
    return null;
  }

  if (isLoadingSettings) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!isStoreOpen && !orderComplete) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center py-16">
          <div className="text-center max-w-md px-4">
            <AlertTriangle className="h-20 w-20 mx-auto text-destructive mb-6" />
            <h1 className="text-3xl font-bold mb-4">Loja Fechada</h1>
            <p className="text-muted-foreground mb-8">
              A loja está fechada no momento. Não é possível finalizar compras agora.
            </p>
            <Link to="/produtos">
              <Button size="lg">Ver Produtos</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (orderComplete && orderResult) {
    const whatsappLink = getWhatsAppLink();
    const orderNumber = orderResult.blingOrderNumber || orderResult.id.slice(0, 8).toUpperCase();
    
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center py-16">
          <div className="text-center max-w-md px-4">
            <CheckCircle className="h-20 w-20 mx-auto text-primary mb-6" />
            <h1 className="text-3xl font-bold mb-4">Pedido Confirmado!</h1>
            <p className="text-muted-foreground mb-2">
              Seu pedido foi realizado com sucesso.
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              Número do pedido: <span className="font-mono font-bold">{orderNumber}</span>
            </p>
            
            {orderResult.nfeIssued && orderResult.nfeNumber && (
              <div className="flex items-center justify-center gap-2 text-sm text-green-600 mb-4">
                <FileText className="h-4 w-4" />
                <span>NF-e emitida: {orderResult.nfeNumber}</span>
              </div>
            )}
            
            <p className="text-muted-foreground mb-8">
              Clique no botão abaixo para enviar os detalhes do pedido via WhatsApp e combinar o pagamento.
            </p>
            
            <div className="flex flex-col gap-3">
              {whatsappLink && (
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <Button size="lg" className="w-full bg-[#25D366] hover:bg-[#20BA5A] text-white">
                    <MessageCircle className="mr-2 h-5 w-5" />
                    Enviar Pedido via WhatsApp
                  </Button>
                </a>
              )}
              <Link to="/produtos">
                <Button size="lg" variant="outline" className="w-full">Continuar Comprando</Button>
              </Link>
            </div>
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
          <Link to="/carrinho" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary mb-8">
            <ArrowLeft className="h-4 w-4" />
            Voltar para o carrinho
          </Link>

          <h1 className="text-3xl font-bold mb-8">Finalizar Compra</h1>

          {stockError && (
            <Alert variant="destructive" className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{stockError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Form */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Dados Pessoais</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="customer_name">Nome Completo *</Label>
                        <Input
                          id="customer_name"
                          name="customer_name"
                          value={formData.customer_name}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customer_email">E-mail *</Label>
                        <Input
                          id="customer_email"
                          name="customer_email"
                          type="email"
                          value={formData.customer_email}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer_phone">Telefone/WhatsApp *</Label>
                      <Input
                        id="customer_phone"
                        name="customer_phone"
                        value={formData.customer_phone}
                        onChange={handleInputChange}
                        placeholder="(00) 00000-0000"
                        required
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Endereço de Entrega</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="customer_address">Endereço Completo *</Label>
                      <Input
                        id="customer_address"
                        name="customer_address"
                        value={formData.customer_address}
                        onChange={handleInputChange}
                        placeholder="Rua, número, complemento"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="customer_city">Cidade *</Label>
                        <Input
                          id="customer_city"
                          name="customer_city"
                          value={formData.customer_city}
                          onChange={handleInputChange}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customer_state">Estado *</Label>
                        <Input
                          id="customer_state"
                          name="customer_state"
                          value={formData.customer_state}
                          onChange={handleInputChange}
                          placeholder="SP"
                          maxLength={2}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customer_zip">CEP *</Label>
                        <Input
                          id="customer_zip"
                          name="customer_zip"
                          value={formData.customer_zip}
                          onChange={handleInputChange}
                          placeholder="00000-000"
                          required
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Observações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder="Alguma observação sobre o pedido? (opcional)"
                      rows={3}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Summary */}
              <div className="lg:col-span-1">
                <Card className="sticky top-24">
                  <CardHeader>
                    <CardTitle>Resumo do Pedido</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {items.map(item => (
                        <div key={item.product.id} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            {item.quantity}x {item.product.name}
                          </span>
                          <span>{formatPrice(item.product.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>{formatPrice(total)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Frete</span>
                        <span className={shippingCost === 0 ? 'text-green-600' : ''}>
                          {shippingCost === 0 ? 'Grátis' : formatPrice(shippingCost)}
                        </span>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>{formatPrice(orderTotal)}</span>
                    </div>

                    {total >= 299 && (
                      <p className="text-xs text-green-600">✓ Frete grátis aplicado!</p>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={createOrder.isPending || isValidatingStock || !!stockError}
                    >
                      {isValidatingStock ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Validando estoque...
                        </>
                      ) : createOrder.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        'Confirmar Pedido'
                      )}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      Após confirmar, você será direcionado para o WhatsApp para combinar o pagamento.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CheckoutPage;
