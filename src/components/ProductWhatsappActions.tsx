import {
  BadgeDollarSign,
  CreditCard,
  MessageCircle,
  PackageCheck,
  UserRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import {
  buildProductIntentMessage,
  buildWhatsappUrl,
  resolveWhatsappNumber,
  type ProductLite,
  type ProductWhatsappIntent,
} from '@/lib/whatsapp';
import { cn } from '@/lib/utils';

interface ProductWhatsappActionsProps {
  product: ProductLite;
  compact?: boolean;
  className?: string;
  onAction?: () => void;
}

const ACTIONS: Array<{
  intent: ProductWhatsappIntent;
  label: string;
  description: string;
  icon: typeof MessageCircle;
}> = [
  {
    intent: 'availability',
    label: 'Verificar disponibilidade',
    description: 'Confirme estoque, retirada ou prazo de entrega.',
    icon: PackageCheck,
  },
  {
    intent: 'quote',
    label: 'Pedir orçamento',
    description: 'Receba o valor final e opções de entrega.',
    icon: BadgeDollarSign,
  },
  {
    intent: 'financing',
    label: 'Parcelamento',
    description: 'Consulte condições de pagamento e financiamento.',
    icon: CreditCard,
  },
  {
    intent: 'seller',
    label: 'Falar com vendedor',
    description: 'Continue o atendimento com a equipe da loja.',
    icon: UserRound,
  },
];

const ProductWhatsappActions = ({
  product,
  compact = false,
  className,
  onAction,
}: ProductWhatsappActionsProps) => {
  const { data: settings } = useStoreSettings();
  const number = resolveWhatsappNumber(settings?.whatsapp);

  return (
    <div
      className={cn(
        compact ? 'space-y-2' : 'rounded-xl border border-[#25D366]/25 bg-[#25D366]/5 p-4 sm:p-5',
        className,
      )}
    >
      {!compact && (
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold">Atendimento pelo WhatsApp</h2>
            <p className="text-sm text-muted-foreground">
              Escolha o assunto. A mensagem já vai com este produto e o link da página.
            </p>
          </div>
        </div>
      )}

      <div className={cn('grid gap-2.5', compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2')}>
        {ACTIONS.map(({ intent, label, description, icon: Icon }, index) => {
          const href = buildWhatsappUrl(number, buildProductIntentMessage(product, intent));
          const isPrimary = index === 0;

          return (
            <Button
              key={intent}
              asChild
              variant={isPrimary ? 'default' : 'outline'}
              className={cn(
                'h-auto min-h-12 justify-start whitespace-normal px-3 py-3 text-left',
                isPrimary && 'bg-[#25D366] text-white hover:bg-[#20BA5A]',
              )}
            >
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onAction}
                aria-label={`${label} sobre ${product.name} pelo WhatsApp`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="min-w-0">
                  <span className="block font-semibold leading-tight">{label}</span>
                  {!compact && (
                    <span className={cn('mt-0.5 block text-xs font-normal', isPrimary ? 'text-white/85' : 'text-muted-foreground')}>
                      {description}
                    </span>
                  )}
                </span>
              </a>
            </Button>
          );
        })}
      </div>

      {!compact && (
        <p className="mt-3 text-xs text-muted-foreground">
          Você será direcionado ao WhatsApp da loja. O atendimento continua com um vendedor.
        </p>
      )}
    </div>
  );
};

export default ProductWhatsappActions;
