import { useState } from 'react';
import {
  useFaqs,
  useCreateFaq,
  useUpdateFaq,
  useDeleteFaq,
  useWhatsappAi,
  useToggleWhatsappAi,
  type Faq,
  type FaqInput,
} from '@/hooks/useFaqs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Plus, Pencil, Trash2, Bot } from 'lucide-react';

const emptyForm: FaqInput = { question: '', answer: '', is_active: true, display_order: 0 };

const AdminFaqsPage = () => {
  const { data: faqs, isLoading } = useFaqs();
  const createFaq = useCreateFaq();
  const updateFaq = useUpdateFaq();
  const deleteFaq = useDeleteFaq();
  const { data: ai } = useWhatsappAi();
  const toggleAi = useToggleWhatsappAi();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Faq | null>(null);
  const [form, setForm] = useState<FaqInput>(emptyForm);

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, display_order: (faqs?.length ?? 0) + 1 });
    setOpen(true);
  };

  const openEdit = (f: Faq) => {
    setEditing(f);
    setForm({
      question: f.question,
      answer: f.answer,
      is_active: f.is_active,
      display_order: f.display_order,
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.question.trim() || !form.answer.trim()) return;
    if (editing) await updateFaq.mutateAsync({ id: editing.id, updates: form });
    else await createFaq.mutateAsync(form);
    setOpen(false);
  };

  const handleDelete = (f: Faq) => {
    if (window.confirm('Remover esta FAQ?')) deleteFaq.mutate(f.id);
  };

  const saving = createFaq.isPending || updateFaq.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6" /> Atendente IA
        </h1>
        <p className="text-sm text-muted-foreground">
          Controle o atendente do WhatsApp e ensine respostas (FAQ). O que você escrever aqui é
          usado pelo atendente na hora de responder.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Atendente automático no WhatsApp</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Switch
              checked={ai?.whatsapp_ai_enabled ?? true}
              disabled={!ai || toggleAi.isPending}
              onCheckedChange={(v) => ai && toggleAi.mutate({ id: ai.id, enabled: v })}
              id="ai-toggle"
            />
            <Label htmlFor="ai-toggle" className="cursor-pointer">
              {ai?.whatsapp_ai_enabled ?? true
                ? 'Ligado — a IA responde os clientes automaticamente'
                : 'Desligado — ninguém recebe resposta automática'}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Dica: mesmo ligado, quando você assume uma conversa pelo WhatsApp a IA fica quieta
            naquele contato até a equipe liberar de novo.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Perguntas e respostas (treino)</CardTitle>
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Nova FAQ
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !faqs || faqs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma FAQ ainda. Adicione perguntas comuns (frete, troca, garantia...).
            </p>
          ) : (
            <div className="space-y-3">
              {faqs.map((f) => (
                <div key={f.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{f.question}</p>
                      {!f.is_active && <Badge variant="secondary">inativa</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{f.answer}</p>
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(f)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(f)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar FAQ' : 'Nova FAQ'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Pergunta *</Label>
              <Input
                value={form.question}
                placeholder="Ex: Vocês fazem entrega para todo o Brasil?"
                onChange={(e) => setForm({ ...form, question: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Resposta *</Label>
              <Textarea
                rows={4}
                value={form.answer}
                placeholder="Resposta que o atendente deve usar."
                onChange={(e) => setForm({ ...form, answer: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_active ?? true}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                id="faq-active"
              />
              <Label htmlFor="faq-active" className="cursor-pointer">
                Ativa (o atendente usa)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFaqsPage;
