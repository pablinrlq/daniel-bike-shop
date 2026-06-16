import { useState } from 'react';
import {
  useServiceOrders,
  useCreateServiceOrder,
  useUpdateServiceOrder,
  useSetServiceStatus,
  useDeleteServiceOrder,
  SERVICE_STATUS_LABELS,
  type ServiceOrder,
  type ServiceStatus,
  type ServiceOrderInput,
} from '@/hooks/useServiceOrders';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Pencil, Trash2, Wrench, MessageCircle } from 'lucide-react';
import { formatPhone } from '@/lib/formatters';

const STATUS_ORDER: ServiceStatus[] = [
  'nao_iniciado',
  'em_andamento',
  'concluido',
  'entregue',
  'cancelado',
];

const statusBadgeClass: Record<ServiceStatus, string> = {
  nao_iniciado: 'bg-muted text-foreground',
  em_andamento: 'bg-blue-100 text-blue-800',
  concluido: 'bg-green-100 text-green-800',
  entregue: 'bg-emerald-100 text-emerald-800',
  cancelado: 'bg-red-100 text-red-800',
};

const emptyForm: ServiceOrderInput = {
  customer_name: '',
  customer_phone: '',
  equipment: '',
  description: '',
  price: null,
  notes: '',
  notify_whatsapp: true,
};

const AdminServicesPage = () => {
  const { data: services, isLoading } = useServiceOrders();
  const createService = useCreateServiceOrder();
  const updateService = useUpdateServiceOrder();
  const setStatus = useSetServiceStatus();
  const deleteService = useDeleteServiceOrder();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceOrder | null>(null);
  const [form, setForm] = useState<ServiceOrderInput>(emptyForm);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (s: ServiceOrder) => {
    setEditing(s);
    setForm({
      customer_name: s.customer_name,
      customer_phone: s.customer_phone,
      equipment: s.equipment ?? '',
      description: s.description ?? '',
      price: s.price,
      notes: s.notes ?? '',
      notify_whatsapp: s.notify_whatsapp,
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.customer_name.trim() || !form.customer_phone.trim()) return;
    if (editing) {
      await updateService.mutateAsync({ id: editing.id, updates: form });
    } else {
      await createService.mutateAsync(form);
    }
    setOpen(false);
  };

  const handleStatusChange = (s: ServiceOrder, status: ServiceStatus) => {
    if (status === s.status) return;
    setStatus.mutate({ id: s.id, status, notify: s.notify_whatsapp });
  };

  const handleDelete = (s: ServiceOrder) => {
    if (window.confirm(`Remover o serviço de ${s.customer_name}?`)) {
      deleteService.mutate(s.id);
    }
  };

  const saving = createService.isPending || updateService.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="h-6 w-6" /> Serviços (Oficina)
          </h1>
          <p className="text-sm text-muted-foreground">
            Registre serviços e mude o status — o cliente é avisado no WhatsApp automaticamente.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> Novo serviço
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ordens de serviço</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !services || services.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum serviço registrado ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Equipamento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Avisar</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.customer_name}</TableCell>
                      <TableCell>{s.customer_phone}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{s.equipment || '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge className={statusBadgeClass[s.status]} variant="secondary">
                            {SERVICE_STATUS_LABELS[s.status]}
                          </Badge>
                          <Select
                            value={s.status}
                            onValueChange={(v) => handleStatusChange(s, v as ServiceStatus)}
                          >
                            <SelectTrigger className="h-8 w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_ORDER.map((st) => (
                                <SelectItem key={st} value={st}>
                                  {SERVICE_STATUS_LABELS[st]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell>
                        {s.notify_whatsapp ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                            <MessageCircle className="h-3 w-3" /> Sim
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Não</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar serviço' : 'Novo serviço'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do cliente *</Label>
                <Input
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone/WhatsApp *</Label>
                <Input
                  value={form.customer_phone}
                  placeholder="(31) 99999-9999"
                  onChange={(e) => setForm({ ...form, customer_phone: formatPhone(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Equipamento</Label>
              <Input
                value={form.equipment ?? ''}
                placeholder="Ex: Caloi Elite 29, aro 29"
                onChange={(e) => setForm({ ...form, equipment: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Serviço / descrição</Label>
              <Textarea
                rows={3}
                value={form.description ?? ''}
                placeholder="Ex: revisão geral, troca de pastilhas de freio"
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, price: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </div>
              <div className="flex items-end gap-3 pb-2">
                <Switch
                  checked={form.notify_whatsapp ?? true}
                  onCheckedChange={(v) => setForm({ ...form, notify_whatsapp: v })}
                  id="notify"
                />
                <Label htmlFor="notify" className="cursor-pointer">
                  Avisar no WhatsApp
                </Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações internas</Label>
              <Textarea
                rows={2}
                value={form.notes ?? ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Salvar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminServicesPage;
