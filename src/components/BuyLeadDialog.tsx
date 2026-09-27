import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ProductWhatsappActions from '@/components/ProductWhatsappActions';
import type { ProductLite } from '@/lib/whatsapp';

interface Props {
  product: ProductLite;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BuyLeadDialog = ({ product, open, onOpenChange }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Falar sobre este produto</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{product.name}</span> — escolha o assunto
            para abrir uma conversa com a loja.
          </DialogDescription>
        </DialogHeader>
        <ProductWhatsappActions
          product={product}
          compact
          onAction={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

export default BuyLeadDialog;
