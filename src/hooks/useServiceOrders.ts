import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type ServiceStatus =
  | 'nao_iniciado'
  | 'em_andamento'
  | 'concluido'
  | 'entregue'
  | 'cancelado';

export interface ServiceOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  equipment: string | null;
  description: string | null;
  status: ServiceStatus;
  price: number | null;
  notes: string | null;
  notify_whatsapp: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceOrderInput {
  customer_name: string;
  customer_phone: string;
  equipment?: string | null;
  description?: string | null;
  price?: number | null;
  notes?: string | null;
  notify_whatsapp?: boolean;
}

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  nao_iniciado: 'Não iniciado',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

// supabase é tipado com as tabelas geradas; tabelas novas (service_orders) usam
// um cliente sem o schema tipado para evitar erro de tipo até regenerar os types.
const db = supabase as unknown as SupabaseClient;

export const useServiceOrders = () => {
  return useQuery({
    queryKey: ['service-orders'],
    queryFn: async (): Promise<ServiceOrder[]> => {
      const { data, error } = await db
        .from('service_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ServiceOrder[];
    },
  });
};

export const useCreateServiceOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ServiceOrderInput): Promise<ServiceOrder> => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await db
        .from('service_orders')
        .insert({ ...input, created_by: user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data as ServiceOrder;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      toast.success('Serviço registrado!');
    },
    onError: () => toast.error('Erro ao registrar serviço.'),
  });
};

export const useUpdateServiceOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ServiceOrderInput> }) => {
      const { error } = await db.from('service_orders').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      toast.success('Serviço atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar serviço.'),
  });
};

// Muda o status e, se notify=true, avisa o cliente no WhatsApp (edge function).
export const useSetServiceStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      notify,
    }: {
      id: string;
      status: ServiceStatus;
      notify: boolean;
    }) => {
      const { error } = await db.from('service_orders').update({ status }).eq('id', id);
      if (error) throw error;

      let notified = false;
      let notifyError: string | undefined;
      if (notify) {
        const { data, error: fnError } = await supabase.functions.invoke('service-notify', {
          body: { serviceOrderId: id },
        });
        if (fnError || (data && data.success === false)) {
          notifyError = (data && data.message) || fnError?.message || 'Falha ao avisar no WhatsApp';
        } else {
          notified = true;
        }
      }
      return { notified, notifyError };
    },
    onSuccess: ({ notified, notifyError }) => {
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      if (notified) toast.success('Status atualizado e cliente avisado no WhatsApp!');
      else if (notifyError) toast.warning(`Status atualizado, mas: ${notifyError}`);
      else toast.success('Status atualizado!');
    },
    onError: () => toast.error('Erro ao atualizar status.'),
  });
};

export const useDeleteServiceOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('service_orders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-orders'] });
      toast.success('Serviço removido.');
    },
    onError: () => toast.error('Erro ao remover serviço.'),
  });
};
