import { useState } from 'react';
import { Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatPhone, isValidPhone } from '@/lib/formatters';
import { useCreateStockAlert } from '@/hooks/useStockAlert';

interface Props {
  productId: string;
  productName: string;
  className?: string;
}

const StockAlertButton = ({ productId, productName, className }: Props) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const create = useCreateStockAlert();

  const submit = async () => {
    if (!isValidPhone(phone)) {
      toast.error('Telefone inválido. Use DDD + número.');
      return;
    }
    await create.mutateAsync({ productId, productName, name: name.trim() || undefined, phone });
    setOpen(false);
    setName('');
    setPhone('');
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={className}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Bell className="mr-2 h-4 w-4" />
        Avise-me quando chegar
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Avisar quando chegar</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            Deixe seu WhatsApp e a gente te avisa assim que <strong>{productName}</strong> voltar ao
            estoque.
          </p>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="sa-name">Nome (opcional)</Label>
              <Input id="sa-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sa-phone">WhatsApp *</Label>
              <Input
                id="sa-phone"
                inputMode="tel"
                placeholder="(31) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Quero ser avisado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StockAlertButton;
