import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Link as LinkIcon,
  Package,
  AlertTriangle
} from 'lucide-react';

const AdminBlingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Check Bling connection status
  const { data: connectionStatus, isLoading: isCheckingConnection, refetch: recheckConnection } = useQuery({
    queryKey: ['bling-connection'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('bling-check-connection');
      if (error) throw error;
      return data as { connected: boolean; authUrl: string; expiresAt: string | null };
    },
    retry: false,
  });

  // Sync products mutation
  const syncProductsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('bling-sync-products');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({
        title: 'Sincronização concluída!',
        description: `${data.synced} produtos sincronizados, ${data.failed} falhas.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro na sincronização',
        description: error.message || 'Não foi possível sincronizar produtos.',
        variant: 'destructive',
      });
    },
  });

  // Get sync stats
  const { data: syncStats } = useQuery({
    queryKey: ['bling-sync-stats'],
    queryFn: async () => {
      const { data: products, error } = await supabase
        .from('products')
        .select('id, sku')
        .not('sku', 'is', null);
      
      if (error) throw error;
      
      const { data: cache } = await supabase
        .from('bling_products_cache')
        .select('synced_at')
        .order('synced_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        productsWithSku: products?.length || 0,
        lastSync: cache?.synced_at || null,
      };
    },
  });

  const handleConnect = () => {
    if (connectionStatus?.authUrl) {
      window.open(connectionStatus.authUrl, '_blank');
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    return new Date(dateStr).toLocaleString('pt-BR');
  };

  if (isCheckingConnection) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integração Bling</h1>
        <p className="text-muted-foreground">Gerencie a sincronização com o ERP Bling</p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Status da Conexão
          </CardTitle>
          <CardDescription>
            Verifique se a integração com o Bling está ativa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {connectionStatus?.connected ? (
                <>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                  <div>
                    <p className="font-semibold">Conectado ao Bling</p>
                    <p className="text-sm text-muted-foreground">
                      Expira em: {formatDate(connectionStatus.expiresAt)}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-8 w-8 text-destructive" />
                  <div>
                    <p className="font-semibold">Não conectado</p>
                    <p className="text-sm text-muted-foreground">
                      Clique em "Conectar" para autorizar
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => recheckConnection()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Verificar
              </Button>
              {!connectionStatus?.connected && (
                <Button onClick={handleConnect}>
                  Conectar ao Bling
                </Button>
              )}
            </div>
          </div>

          {connectionStatus?.connected && (
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">URL de Callback (para configurar no Bling):</h4>
              <code className="block p-3 bg-muted rounded text-sm break-all">
                {`${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/bling-oauth-callback`}
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Sync */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Sincronização de Produtos
          </CardTitle>
          <CardDescription>
            Importe produtos do Bling para a loja
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Produtos com SKU</p>
              <p className="text-2xl font-bold">{syncStats?.productsWithSku || 0}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Última Sincronização</p>
              <p className="text-lg font-medium">{formatDate(syncStats?.lastSync || null)}</p>
            </div>
          </div>

          {!connectionStatus?.connected && (
            <div className="flex items-center gap-2 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <p className="text-sm">Conecte ao Bling primeiro para sincronizar produtos.</p>
            </div>
          )}

          <Button 
            onClick={() => syncProductsMutation.mutate()}
            disabled={!connectionStatus?.connected || syncProductsMutation.isPending}
            className="w-full"
            size="lg"
          >
            {syncProductsMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sincronizar Produtos do Bling
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Como funciona a integração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>✅ <strong>Produtos:</strong> Sincronize produtos do Bling com nome, preço, estoque e SKU.</p>
          <p>✅ <strong>Pedidos:</strong> Ao finalizar uma compra, o pedido é criado automaticamente no Bling.</p>
          <p>✅ <strong>Clientes:</strong> Clientes são cadastrados automaticamente como contatos no Bling.</p>
          <p>✅ <strong>NF-e:</strong> Após criar o pedido, a nota fiscal é emitida automaticamente.</p>
          <p>✅ <strong>WhatsApp:</strong> O cliente recebe os detalhes do pedido e NF-e via WhatsApp.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminBlingPage;
