import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { formatPhone } from '@/lib/formatters';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import {
  buildLeadMessage,
  buildWhatsappUrl,
  resolveWhatsappNumber,
  type LeadData,
  type ProductLite,
} from '@/lib/whatsapp';

interface Props {
  product: ProductLite;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)'];
const ESCOLARIDADES = [
  'Ensino Fundamental',
  'Ensino Médio',
  'Ensino Superior',
  'Pós-graduação',
];

const EMPTY: LeadData = {
  nome: '',
  cpf: '',
  celular: '',
  email: '',
  profissao: '',
  renda: '',
  escolaridade: '',
  estadoCivil: '',
  conjugeNome: '',
  conjugeCpf: '',
};

// CPF: 000.000.000-00
const formatCpf = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
};

const BuyLeadDialog = ({ product, open, onOpenChange }: Props) => {
  const { data: settings } = useStoreSettings();
  const [form, setForm] = useState<LeadData>(EMPTY);
  const [sending, setSending] = useState(false);

  const set = (k: keyof LeadData, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const isMarried = form.estadoCivil === 'Casado(a)' || form.estadoCivil === 'União estável';

  const submit = () => {
    const required: [string, string][] = [
      ['Nome completo', form.nome],
      ['CPF', form.cpf],
      ['Celular', form.celular],
      ['E-mail', form.email],
      ['Profissão', form.profissao],
      ['Renda Bruta Mensal', form.renda],
      ['Escolaridade', form.escolaridade],
      ['Estado Civil', form.estadoCivil],
    ];
    const missing = required.find(([, v]) => !v.trim());
    if (missing) {
      toast.error(`Preencha: ${missing[0]}`);
      return;
    }
    if (isMarried && (!form.conjugeNome?.trim() || !form.conjugeCpf?.trim())) {
      toast.error('Informe o nome e CPF do cônjuge.');
      return;
    }
    setSending(true);
    const number = resolveWhatsappNumber(settings?.whatsapp);
    const msg = buildLeadMessage(product, form);
    window.open(buildWhatsappUrl(number, msg), '_blank', 'noopener,noreferrer');
    setSending(false);
    onOpenChange(false);
    setForm(EMPTY);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Quero esse</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{product.name}</span> — preencha seus dados
            pra agilizar o atendimento e a análise de crédito. Enviamos tudo pelo WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Dados pessoais */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">📝 Dados pessoais</h4>
            <div className="space-y-1">
              <Label htmlFor="l-nome">Nome completo *</Label>
              <Input id="l-nome" value={form.nome} onChange={(e) => set('nome', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="l-cpf">CPF *</Label>
                <Input
                  id="l-cpf"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={form.cpf}
                  onChange={(e) => set('cpf', formatCpf(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="l-cel">Celular *</Label>
                <Input
                  id="l-cel"
                  inputMode="tel"
                  placeholder="(31) 99999-9999"
                  value={form.celular}
                  onChange={(e) => set('celular', formatPhone(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="l-email">E-mail *</Label>
              <Input
                id="l-email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>
          </div>

          {/* Profissionais */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">💼 Informações profissionais</h4>
            <div className="space-y-1">
              <Label htmlFor="l-prof">Profissão *</Label>
              <Input id="l-prof" value={form.profissao} onChange={(e) => set('profissao', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="l-renda">Renda Bruta Mensal *</Label>
                <Input
                  id="l-renda"
                  placeholder="Ex: R$ 3.500"
                  value={form.renda}
                  onChange={(e) => set('renda', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Escolaridade *</Label>
                <Select value={form.escolaridade} onValueChange={(v) => set('escolaridade', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESCOLARIDADES.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Estado civil */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">❤️ Estado civil</h4>
            <div className="space-y-1">
              <Label>Estado Civil *</Label>
              <Select value={form.estadoCivil} onValueChange={(v) => set('estadoCivil', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {ESTADOS_CIVIS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isMarried && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-border p-3">
                <div className="space-y-1">
                  <Label htmlFor="l-cnome">Nome do cônjuge *</Label>
                  <Input
                    id="l-cnome"
                    value={form.conjugeNome}
                    onChange={(e) => set('conjugeNome', e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="l-ccpf">CPF do cônjuge *</Label>
                  <Input
                    id="l-ccpf"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={form.conjugeCpf}
                    onChange={(e) => set('conjugeCpf', formatCpf(e.target.value))}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={sending}
            className="bg-[#25D366] hover:bg-[#20BA5A] text-white"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Enviar pelo WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BuyLeadDialog;
