import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateOrder } from '@/hooks/useOrders';
import { useValidateStock } from '@/hooks/useStockValidation';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { useCepLookup } from '@/hooks/useCepLookup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  MessageCircle,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BRAZIL_STATES,
  formatCep,
  formatPhone,
  isValidCep,
  isValidEmail,
  isValidPhone,
  onlyDigits,
} from '@/lib/formatters';
import { calculateShipping, hasEarnedFreeShipping } from '@/lib/shipping';

const FALLBACK_WHATSAPP = '5531995326386';

const checkoutSchema = z.object({
  customer_name: z
    .string()
    .trim()
    .min(3, 'Informe seu nome completo')
    .max(120, 'Nome muito longo'),
  customer_email: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isValidEmail, 'E-mail inválido'),
  customer_phone: z
    .string()
    .refine(isValidPhone, 'Telefone inválido. Use DDD + número.'),
  customer_zip: z
    .string()
    .refine(isValidCep, 'CEP inválido. Use 8 dígitos.'),
  customer_address: z
    .string()
    .trim()
    .min(5, 'Endereço muito curto')
    .max(200, 'Endereço muito longo'),
  customer_city: z.string().trim().min(2, 'Informe a cidade').max(80),
  customer_state: z
    .string()
    .length(2, 'Selecione um estado')
    .refine((v) => BRAZIL_STATES.some((s) => s.value === v), 'Estado inválido'),
  notes: z.string().max(500, 'Observações muito longas').optional(),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

interface OrderResult {
  id: string;
  blingOrderId?: string;
  blingOrderNumber?: string;
  nfeIssued?: boolean;
  nfeNumber?: string;
}

type PaymentMethod = 'pix' | 'card' | 'whatsapp';

const CheckoutPage = () => {
  const { items, total, clearCart, coupon, discount } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const createOrder = useCreateOrder();
  const validateStock = useValidateStock();
  const { data: storeSettings, isLoading: isLoadingSettings } = useStoreSettings();
  const { lookup: lookupCep, isLoading: isLoadingCep } = useCepLookup();

  const [orderComplete, setOrderComplete] = useState(false);
  const [orderResult, setOrderResult] = useState<OrderResult | null>(null);
  const [stockError, setStockError] = useState<string | null>(null);
  const [isValidatingStock, setIsValidatingStock] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [isStartingPayment, setIsStartingPayment] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
    mode: 'onBlur',
    defaultValues: {
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      customer_zip: '',
      customer_address: '',
      customer_city: '',
      customer_state: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (!user) return;
    const metadata = user.user_metadata as { full_name?: string } | null;
    if (metadata?.full_name) setValue('customer_name', metadata.full_name);
    if (user.email) setValue('customer_email', user.email);
  }, [user, setValue]);

  const shippingCost = calculateShipping(total);
  const orderTotal = total - discount + shippingCost;
  const isStoreOpen = storeSettings?.is_store_open ?? true;
  const whatsappNumber =
    onlyDigits(storeSettings?.whatsapp || '') || FALLBACK_WHATSAPP;

  useEffect(() => {
    if (items.length === 0 && !orderComplete) {
      navigate('/carrinho', { replace: true });
    }
  }, [items.length, orderComplete, navigate]);

  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;
    setIsValidatingStock(true);
    validateStock
      .mutateAsync(
        items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      )
      .then((result) => {
        if (cancelled) return;
        if (!result.valid) {
          if (result.error === 'store_closed') {
            setStockError(result.message || 'A loja está fechada no momento.');
          } else if (result.results) {
            const invalid = result.results.filter((r) => !r.valid);
            setStockError(invalid.map((r) => r.message).join('; '));
          }
        } else {
          setStockError(null);
        }
      })
      .catch((err) => {
        console.error('Stock validation error:', err);
      })
      .finally(() => {
        if (!cancelled) setIsValidatingStock(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCepBlur = async (value: string) => {
    if (!isValidCep(value)) return;
    const data = await lookupCep(value);
    if (!data) return;
    if (data.logradouro) setValue('customer_address', data.logradouro, { shouldValidate: true });
    if (data.localidade) setValue('customer_city', data.localidade, { shouldValidate: true });
    if (data.uf) setValue('customer_state', data.uf, { shouldValidate: true });
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

  const generateWhatsAppMessage = (result: OrderResult, form: CheckoutForm) => {
    const orderNumber = result.blingOrderNumber || result.id.slice(0, 8).toUpperCase();
    const lines = [
      '🚲 *PEDIDO CONFIRMADO - DANIEL BIKE SHOP*',
      '━━━━━━━━━━━━━━━━━━━━━━',
      '',
      `📋 *Pedido:* #${orderNumber}`,
      `👤 *Cliente:* ${form.customer_name}`,
      `📧 *E-mail:* ${form.customer_email}`,
      `📱 *Telefone:* ${form.customer_phone}`,
      '',
      '📍 *Endereço de Entrega:*',
      form.customer_address,
      `${form.customer_city} - ${form.customer_state}`,
      `CEP: ${form.customer_zip}`,
      '',
      '📦 *PRODUTOS:*',
      '━━━━━━━━━━━━━━━━━━━━━━',
    ];

    items.forEach((item, index) => {
      lines.push(
        `${index + 1}. *${item.product.name}*`,
        `   ${item.quantity}x ${formatPrice(item.product.price)} = ${formatPrice(
          item.product.price * item.quantity,
        )}`,
      );
    });

    lines.push(
      '',
      '━━━━━━━━━━━━━━━━━━━━━━',
      '💰 *RESUMO:*',
      `   Subtotal: ${formatPrice(total)}`,
    );

    if (discount > 0 && coupon) {
      lines.push(`   Desconto (${coupon.code}): -${formatPrice(discount)}`);
    }

    lines.push(
      `   Frete: ${shippingCost === 0 ? 'GRÁTIS 🎉' : formatPrice(shippingCost)}`,
      `   *TOTAL: ${formatPrice(orderTotal)}*`,
      '',
    );

    if (result.nfeIssued && result.nfeNumber) {
      lines.push(`✅ *NF-e emitida:* ${result.nfeNumber}`, '');
    }
    if (form.notes) {
      lines.push(`📝 *Observações:* ${form.notes}`, '');
    }

    lines.push('━━━━━━━━━━━━━━━━━━━━━━', '_Aguardando confirmação de pagamento_');
    return encodeURIComponent(lines.join('\n'));
  };

  const onSubmit = async (values: CheckoutForm) => {
    setStockError(null);

    setIsValidatingStock(true);
    try {
      const stockResult = await validateStock.mutateAsync(
        items.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
      );
      if (!stockResult.valid) {
        if (stockResult.error === 'store_closed') {
          setStockError(stockResult.message || 'A loja está fechada no momento.');
          toast.error('A loja está fechada no momento.');
        } else if (stockResult.results) {
          const invalid = stockResult.results.filter((r) => !r.valid);
          setStockError(invalid.map((r) => r.message).join('; '));
          toast.error('Alguns produtos estão indisponíveis');
        }
        return;
      }
    } catch (err) {
      console.error('Stock validation error:', err);
      setStockError('Erro ao validar estoque. Tente novamente.');
      return;
    } finally {
      setIsValidatingStock(false);
    }

    const orderItems = items.map((item) => ({
      product_id: item.product.id,
      product_name: item.product.name,
      product_price: item.product.price,
      quantity: item.quantity,
      subtotal: item.product.price * item.quantity,
    }));

    try {
      const order = await createOrder.mutateAsync({
        customer_name: values.customer_name,
        customer_email: values.customer_email,
        customer_phone: values.customer_phone,
        customer_address: values.customer_address,
        customer_city: values.customer_city,
        customer_state: values.customer_state,
        customer_zip: values.customer_zip,
        notes: values.notes,
        subtotal: total,
        shipping_cost: shippingCost,
        discount_amount: discount,
        coupon_code: coupon?.code,
        total: orderTotal,
        items: orderItems,
      });

      if (paymentMethod === 'pix' || paymentMethod === 'card') {
        setIsStartingPayment(true);
        try {
          const { data: mp, error: mpError } = await supabase.functions.invoke<{
            initPoint?: string;
            sandboxInitPoint?: string;
            error?: string;
            message?: string;
          }>('mp-create-preference', {
            body: { orderId: order.id, paymentMethod },
          });
          if (mpError) throw mpError;
          const target = mp?.initPoint || mp?.sandboxInitPoint;
          if (!target) throw new Error(mp?.message || 'Falha ao iniciar pagamento');
          clearCart();
          window.location.href = target;
          return;
        } catch (err) {
          console.error('Mercado Pago error:', err);
          toast.error(
            err instanceof Error
              ? err.message
              : 'Erro ao iniciar pagamento. Tente o WhatsApp.',
          );
          // Fallback: still show the WhatsApp success screen so the order isn't lost
        } finally {
          setIsStartingPayment(false);
        }
      }

      setOrderResult(order as OrderResult);
      setOrderComplete(true);
      clearCart();
    } catch (err: any) {
      console.error('Erro ao criar pedido:', err);
      toast.error(err.message || 'Erro ao criar pedido');
    }
  };

  if (items.length === 0 && !orderComplete) return null;

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
    const form = watch();
    const message = generateWhatsAppMessage(orderResult, form);
    const whatsappLink = `https://wa.me/${whatsappNumber}?text=${message}`;
    const orderNumber =
      orderResult.blingOrderNumber || orderResult.id.slice(0, 8).toUpperCase();

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
              Clique no botão abaixo para enviar os detalhes do pedido via WhatsApp e combinar
              o pagamento.
            </p>

            <div className="flex flex-col gap-3">
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="w-full bg-[#25D366] hover:bg-[#20BA5A] text-white">
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Enviar Pedido via WhatsApp
                </Button>
              </a>
              <Link to="/produtos">
                <Button size="lg" variant="outline" className="w-full">
                  Continuar Comprando
                </Button>
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
          <Link
            to="/carrinho"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary mb-8"
          >
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

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                          autoComplete="name"
                          aria-invalid={!!errors.customer_name}
                          {...register('customer_name')}
                        />
                        {errors.customer_name && (
                          <p className="text-xs text-destructive">{errors.customer_name.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customer_email">E-mail *</Label>
                        <Input
                          id="customer_email"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          aria-invalid={!!errors.customer_email}
                          {...register('customer_email')}
                        />
                        {errors.customer_email && (
                          <p className="text-xs text-destructive">{errors.customer_email.message}</p>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer_phone">Telefone/WhatsApp *</Label>
                      <Controller
                        control={control}
                        name="customer_phone"
                        render={({ field }) => (
                          <Input
                            id="customer_phone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="(00) 00000-0000"
                            value={field.value}
                            onChange={(e) => field.onChange(formatPhone(e.target.value))}
                            onBlur={field.onBlur}
                            aria-invalid={!!errors.customer_phone}
                          />
                        )}
                      />
                      {errors.customer_phone && (
                        <p className="text-xs text-destructive">{errors.customer_phone.message}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Endereço de Entrega</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2 md:col-span-1">
                        <Label htmlFor="customer_zip">
                          CEP *{' '}
                          {isLoadingCep && (
                            <Loader2 className="inline h-3 w-3 animate-spin ml-1" />
                          )}
                        </Label>
                        <Controller
                          control={control}
                          name="customer_zip"
                          render={({ field }) => (
                            <Input
                              id="customer_zip"
                              inputMode="numeric"
                              autoComplete="postal-code"
                              placeholder="00000-000"
                              value={field.value}
                              onChange={(e) => field.onChange(formatCep(e.target.value))}
                              onBlur={(e) => {
                                field.onBlur();
                                handleCepBlur(e.target.value);
                              }}
                              aria-invalid={!!errors.customer_zip}
                            />
                          )}
                        />
                        {errors.customer_zip && (
                          <p className="text-xs text-destructive">{errors.customer_zip.message}</p>
                        )}
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="customer_address">Endereço Completo *</Label>
                        <Input
                          id="customer_address"
                          autoComplete="street-address"
                          placeholder="Rua, número, complemento"
                          aria-invalid={!!errors.customer_address}
                          {...register('customer_address')}
                        />
                        {errors.customer_address && (
                          <p className="text-xs text-destructive">{errors.customer_address.message}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="customer_city">Cidade *</Label>
                        <Input
                          id="customer_city"
                          autoComplete="address-level2"
                          aria-invalid={!!errors.customer_city}
                          {...register('customer_city')}
                        />
                        {errors.customer_city && (
                          <p className="text-xs text-destructive">{errors.customer_city.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="customer_state">Estado *</Label>
                        <Controller
                          control={control}
                          name="customer_state"
                          render={({ field }) => (
                            <Select value={field.value} onValueChange={field.onChange}>
                              <SelectTrigger
                                id="customer_state"
                                aria-invalid={!!errors.customer_state}
                              >
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {BRAZIL_STATES.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    {s.value} — {s.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                        {errors.customer_state && (
                          <p className="text-xs text-destructive">{errors.customer_state.message}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Forma de Pagamento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {([
                        { id: 'pix', label: 'Pix', hint: 'À vista, aprovação imediata' },
                        { id: 'card', label: 'Cartão', hint: 'Crédito ou débito' },
                        { id: 'whatsapp', label: 'Combinar via WhatsApp', hint: 'Pagar manualmente' },
                      ] as { id: PaymentMethod; label: string; hint: string }[]).map((opt) => {
                        const selected = paymentMethod === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setPaymentMethod(opt.id)}
                            aria-pressed={selected}
                            className={`text-left rounded-lg border p-3 transition-colors ${
                              selected
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/40'
                            }`}
                          >
                            <div className="font-medium">{opt.label}</div>
                            <div className="text-xs text-muted-foreground mt-1">{opt.hint}</div>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Observações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Alguma observação sobre o pedido? (opcional)"
                      rows={3}
                      {...register('notes')}
                    />
                    {errors.notes && (
                      <p className="text-xs text-destructive mt-2">{errors.notes.message}</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1">
                <Card className="sticky top-24">
                  <CardHeader>
                    <CardTitle>Resumo do Pedido</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {items.map((item) => (
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
                      {discount > 0 && coupon && (
                        <div className="flex justify-between text-primary">
                          <span>Desconto ({coupon.code})</span>
                          <span>-{formatPrice(discount)}</span>
                        </div>
                      )}
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

                    {hasEarnedFreeShipping(total) && (
                      <p className="text-xs text-green-600">✓ Frete grátis aplicado!</p>
                    )}

                    <Button
                      type="submit"
                      className="w-full"
                      size="lg"
                      disabled={
                        createOrder.isPending ||
                        isSubmitting ||
                        isValidatingStock ||
                        isStartingPayment ||
                        !!stockError
                      }
                    >
                      {isValidatingStock ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Validando estoque...
                        </>
                      ) : isStartingPayment ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Redirecionando para o Mercado Pago...
                        </>
                      ) : createOrder.isPending || isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processando...
                        </>
                      ) : paymentMethod === 'pix' ? (
                        'Pagar com Pix'
                      ) : paymentMethod === 'card' ? (
                        'Pagar com Cartão'
                      ) : (
                        'Confirmar Pedido'
                      )}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      {paymentMethod === 'whatsapp'
                        ? 'Após confirmar, você será direcionado para o WhatsApp para combinar o pagamento.'
                        : 'Você será redirecionado para o ambiente seguro do Mercado Pago para concluir o pagamento.'}
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
