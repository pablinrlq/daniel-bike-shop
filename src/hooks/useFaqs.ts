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

export interface WhatsappSettings {
  id: string;
  whatsapp_ai_enabled: boolean;
  whatsapp_followup_enabled: boolean;
}

// Configurações do atendente de IA (liga/desliga + follow-up proativo).
// select('*') é resiliente: não quebra se a coluna de follow-up ainda não foi
// criada no banco (defaults aplicados no consumidor).
export const useWhatsappAi = () => {
  return useQuery({
    queryKey: ['whatsapp-ai-toggle'],
    queryFn: async (): Promise<WhatsappSettings | null> => {
      const { data, error } = await db
        .from('store_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as Record<string, unknown>;
      return {
        id: row.id as string,
        whatsapp_ai_enabled: (row.whatsapp_ai_enabled as boolean) ?? true,
        whatsapp_followup_enabled: (row.whatsapp_followup_enabled as boolean) ?? true,
      };
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

// Liga/desliga o follow-up proativo (a IA cutuca clientes que não fecharam).
export const useToggleWhatsappFollowup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await db
        .from('store_settings')
        .update({ whatsapp_followup_enabled: enabled })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-ai-toggle'] });
      toast.success(vars.enabled ? 'Follow-up proativo ligado.' : 'Follow-up proativo desligado.');
    },
    onError: () => toast.error('Erro ao alterar o follow-up.'),
  });
};
