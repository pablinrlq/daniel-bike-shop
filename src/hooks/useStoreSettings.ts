import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface StoreSettings {
  id: string;
  store_name: string;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  working_hours: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  currency: string;
  is_store_open: boolean;
}

export const useStoreSettings = () => {
  return useQuery({
    queryKey: ['store-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data as StoreSettings | null) ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
};

export const useToggleStoreOpen = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, isOpen }: { id: string; isOpen: boolean }) => {
      const { error } = await supabase
        .from('store_settings')
        .update({ is_store_open: isOpen })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-settings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-store-settings'] });
    },
  });
};
