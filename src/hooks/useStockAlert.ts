import { useMutation } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// stock_alerts não está nos types gerados ainda — cliente sem schema tipado.
const db = supabase as unknown as SupabaseClient;

interface StockAlertInput {
  productId: string;
  productName: string;
  name?: string;
  phone: string;
}

export const useCreateStockAlert = () =>
  useMutation({
    mutationFn: async ({ productId, productName, name, phone }: StockAlertInput) => {
      const { error } = await db.from('stock_alerts').insert({
        product_id: productId,
        product_name: productName,
        customer_name: name || null,
        customer_phone: phone,
      });
      // 23505 = esse número já pediu aviso desse produto → trata como sucesso.
      if (error && (error as { code?: string }).code !== '23505') throw error;
    },
    onSuccess: () => toast.success('Pronto! Vamos te avisar no WhatsApp assim que chegar.'),
    onError: () => toast.error('Não consegui registrar o aviso. Tenta de novo?'),
  });
