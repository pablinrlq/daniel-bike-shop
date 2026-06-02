import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MyOrder {
  id: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  subtotal: number;
  shipping_cost: number;
  discount_amount: number;
  total: number;
  coupon_code: string | null;
  created_at: string;
  items: Array<{
    id: string;
    product_name: string;
    product_price: number;
    quantity: number;
    subtotal: number;
  }>;
}

export const useMyOrders = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['my-orders', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<MyOrder[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select(
          `id, status, payment_status, payment_method, subtotal, shipping_cost,
           discount_amount, total, coupon_code, created_at,
           items:order_items(id, product_name, product_price, quantity, subtotal)`,
        )
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as MyOrder[];
    },
  });
};
