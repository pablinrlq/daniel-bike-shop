import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Faq {
  id: string;
  question: string;
  answer: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface FaqInput {
  question: string;
  answer: string;
  is_active?: boolean;
  display_order?: number;
}

// tabelas novas (faqs) sem schema tipado até regenerar os types.
const db = supabase as unknown as SupabaseClient;

export const useFaqs = () => {
  return useQuery({
    queryKey: ['faqs-admin'],
    queryFn: async (): Promise<Faq[]> => {
      const { data, error } = await db
        .from('faqs')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Faq[];
    },
  });
};

export const useCreateFaq = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: FaqInput) => {
      const { error } = await db.from('faqs').insert(input);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faqs-admin'] });
      toast.success('FAQ adicionada! O atendente já vai usar.');
    },
    onError: () => toast.error('Erro ao salvar a FAQ.'),
  });
};

export const useUpdateFaq = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FaqInput> }) => {
      const { error } = await db.from('faqs').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faqs-admin'] });
      toast.success('FAQ atualizada!');
    },
    onError: () => toast.error('Erro ao atualizar a FAQ.'),
  });
};

export const useDeleteFaq = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('faqs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faqs-admin'] });
      toast.success('FAQ removida.');
    },
    onError: () => toast.error('Erro ao remover a FAQ.'),
  });
};

// Liga/desliga o atendente de IA (store_settings.whatsapp_ai_enabled).
export const useWhatsappAi = () => {
  return useQuery({
    queryKey: ['whatsapp-ai-toggle'],
    queryFn: async () => {
      const { data, error } = await db
        .from('store_settings')
        .select('id, whatsapp_ai_enabled')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; whatsapp_ai_enabled: boolean } | null;
    },
  });
};

export const useToggleWhatsappAi = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await db
        .from('store_settings')
        .update({ whatsapp_ai_enabled: enabled })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-ai-toggle'] });
      toast.success(vars.enabled ? 'Atendente de IA ligado.' : 'Atendente de IA desligado.');
    },
    onError: () => toast.error('Erro ao alterar o atendente.'),
  });
};
