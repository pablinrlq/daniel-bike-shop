import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface OrderItem {
  product_id: string;
  product_name: string;
  product_price: number;
  quantity: number;
  subtotal: number;
}

export interface CreateOrderData {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  customer_city: string;
  customer_state: string;
  customer_zip: string;
  subtotal: number;
  shipping_cost: number;
  discount_amount?: number;
  coupon_code?: string;
  total: number;
  notes?: string;
  items: OrderItem[];
}

export const useCreateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderData: CreateOrderData) => {
      const { items, discount_amount: _ignoredDiscount, total: _ignoredTotal, ...orderInfo } = orderData;
      // discount_amount and total are recomputed by a DB trigger
      // based on the coupon_code — see migration phase2_coupon_server_side.

      // Attach the current user (if any) so the customer can see their order later
      const { data: { user } } = await supabase.auth.getUser();

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({ ...orderInfo, user_id: user?.id ?? null })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map(item => ({
        order_id: order.id,
        ...item,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Fire-and-forget: notify the customer the order was received
      supabase.functions
        .invoke('send-order-email', { body: { orderId: order.id, kind: 'created' } })
        .catch((e) => console.error('send-order-email (created) failed:', e));

      // Process order with Bling (create order + NF-e)
      try {
        const { data: blingResult, error: blingError } = await supabase.functions.invoke('bling-create-order', {
          body: { orderId: order.id },
        });

        if (blingError) {
          console.error('Bling processing error:', blingError);
          // Order is created, but Bling sync failed - don't fail the order
        } else if (blingResult) {
          return {
            ...order,
            blingOrderId: blingResult.blingOrderId,
            blingOrderNumber: blingResult.orderNumber,
            nfeIssued: blingResult.nfeIssued,
            nfeNumber: blingResult.nfeNumber,
          };
        }
      } catch (e) {
        console.error('Failed to process with Bling:', e);
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Pedido realizado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao criar pedido:', error);
      toast.error('Erro ao finalizar pedido. Tente novamente.');
    },
  });
};

export const useOrders = () => {
  return useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          items:order_items(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};

export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Status do pedido atualizado!');
    },
    onError: () => {
      toast.error('Erro ao atualizar status do pedido.');
    },
  });
};

// Hook to check Bling connection status
export const useBlingConnection = () => {
  return useQuery({
    queryKey: ['bling-connection'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('bling-check-connection');
      if (error) throw error;
      return data as { connected: boolean; authUrl: string; expiresAt: string | null };
    },
    staleTime: 60000, // 1 minute
  });
};

// Hook to sync products from Bling
export const useSyncBlingProducts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('bling-sync-products');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(`Sincronização concluída! ${data.synced} produtos atualizados.`);
    },
    onError: (error) => {
      console.error('Sync error:', error);
      toast.error('Erro ao sincronizar produtos com Bling.');
    },
  });
};
