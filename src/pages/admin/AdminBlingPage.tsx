import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Link as LinkIcon,
  Package,
  AlertTriangle,
  Sparkles,
  Database,
  Clock,
} from 'lucide-react';

interface SyncResult {
  success: boolean;
  upToDate: boolean;
  synced: number;
  failed: number;
  imagesUpdated: number;
  total: number;
  hasMore: boolean;
  nextPage: number;
  lastPageFetched: number;
  mode?: 'incremental' | 'full';
  message?: string;
  error?: string;
}

interface SyncState {
  id: number;
  last_incremental_sync_at: string | null;
  last_full_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_synced_count: number;
  last_sync_failed_count: number;
  last_sync_images_count: number;
  last_sync_error: string | null;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return 'Nunca';
  return new Date(dateStr).toLocaleString('pt-BR');
};

const timeAgo = (dateStr: string | null): { label: string; staleHours: number } => {
  if (!dateStr) return { label: 'Nunca sincronizado', staleHours: Infinity };
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return { label: `${days} dia${days > 1 ? 's' : ''} atrás`, staleHours: hours };
  if (hours > 0) return { label: `${hours} hora${hours > 1 ? 's' : ''} atrás`, staleHours: hours };
  if (minutes > 0) return { label: `${minutes} min atrás`, staleHours: 0 };
  return { label: 'Agora mesmo', staleHours: 0 };
};

const AdminBlingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: connectionStatus, isLoading: isCheckingConnection, refetch: recheckConnection } = useQuery({
    queryKey: ['bling-connection'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('bling-check-connection');
      if (error) throw error;
      return data as { connected: boolean; authUrl: string; expiresAt: string | null };
    },
    retry: false,
  });

  const { data: syncState } = useQuery({
    queryKey: ['bling-sync-state'],
    queryFn: async (): Promise<SyncState | null> => {
      const { data, error } = await supabase
        .from('bling_sync_state')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      return data as SyncState | null;
    },
    refetchInterval: 10_000, // atualiza a cada 10s
  });

  const { data: productsCount } = useQuery({
    queryKey: ['bling-products-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .not('sku', 'is', null);
      return count ?? 0;
    },
  });

  // Sync products — loop em lotes ate hasMore=false.
  const [skipImageDetail, setSkipImageDetail] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentMode, setCurrentMode] = useState<'incremental' | 'full' | null>(null);
  const [progress, setProgress] = useState<{
    totalSynced: number;
    totalFailed: number;
    totalImages: number;
    currentPage: number;
  }>({ totalSynced: 0, totalFailed: 0, totalImages: 0, currentPage: 0 });

  const runSync = async (mode: 'incremental' | 'full') => {
    setIsSyncing(true);
    setCurrentMode(mode);
    setProgress({ totalSynced: 0, totalFailed: 0, totalImages: 0, currentPage: 0 });
    let nextPage = 1;
    let totalSynced = 0;
    let totalFailed = 0;
    let totalImages = 0;
    let upToDate = false;

    try {
      for (let i = 0; i < 50; i++) {
        const { data, error } = await supabase.functions.invoke<SyncResult>(
          'bling-sync-products',
          { body: { startPage: nextPage, skipImageDetail, mode } },
        );
        if (error) throw error;
        if (!data) throw new Error('Resposta vazia da function');
        if (!data.success) throw new Error(data.error || 'Erro desconhecido');

        totalSynced += data.synced;
        totalFailed += data.failed;
        totalImages += data.imagesUpdated;
        setProgress({
          totalSynced,
          totalFailed,
          totalImages,
          currentPage: data.lastPageFetched,
        });

        if (data.upToDate) {
          upToDate = true;
          break;
        }
        if (!data.hasMore) break;
        nextPage = data.nextPage;
      }

      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['bling-sync-state'] });
      queryClient.invalidateQueries({ queryKey: ['bling-products-count'] });

      if (upToDate && totalSynced === 0) {
        toast({
          title: 'Já está sincronizado',
          description: 'Nada mudou no Bling desde a última sincronização.',
        });
      } else {
        toast({
          title: mode === 'full' ? 'Sync completa concluída!' : 'Sync incremental concluída!',
          description: `${totalSynced} produtos OK · ${totalFailed} falhas · ${totalImages} imagens atualizadas.`,
        });
      }
    } catch (e) {
      toast({
        title: 'Erro na sincronização',
        description: e instanceof Error ? e.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
      setCurrentMode(null);
    }
  };

  const handleConnect = () => {
    if (connectionStatus?.authUrl) {
      window.open(connectionStatus.authUrl, '_blank');
    }
  };

  if (isCheckingConnection) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const lastSync = syncState?.last_incremental_sync_at ?? null;
  const { label: lastSyncLabel, staleHours } = timeAgo(lastSync);
  const isStale = staleHours >= 24;
  const lastStatus = syncState?.last_sync_status;

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
              <Button variant="outline" size="sm" onClick={() => recheckConnection()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Verificar
              </Button>
              {!connectionStatus?.connected && (
                <Button onClick={handleConnect}>Conectar ao Bling</Button>
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

      {/* Sync Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Status do Catálogo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Produtos importados</p>
              <p className="text-2xl font-bold">{productsCount ?? '—'}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Última sincronização
              </p>
              <p className="text-base font-semibold mt-1">{lastSyncLabel}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{formatDate(lastSync)}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Estado</p>
              <div className="mt-1">
                {lastStatus === 'ok' && <Badge className="bg-green-600">OK</Badge>}
                {lastStatus === 'up_to_date' && <Badge variant="secondary">Atualizado</Badge>}
                {lastStatus === 'partial' && <Badge className="bg-yellow-600">Parcial</Badge>}
                {lastStatus === 'error' && <Badge variant="destructive">Erro</Badge>}
                {!lastStatus && <Badge variant="outline">Nunca rodou</Badge>}
              </div>
            </div>
          </div>

          {syncState?.last_sync_error && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Último erro:</p>
                <p className="text-muted-foreground break-all">{syncState.last_sync_error}</p>
              </div>
            </div>
          )}

          {isStale && lastStatus !== 'error' && (
            <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm">
              <Clock className="h-5 w-5 text-yellow-600 shrink-0" />
              <p>
                A última sincronização foi há <strong>{lastSyncLabel}</strong>. Pode estar
                desatualizado — recomendamos rodar uma sincronização incremental.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Sincronização
          </CardTitle>
          <CardDescription>
            <strong>Incremental</strong> pega só o que mudou no Bling desde a última sync (rápido).
            Use <strong>Completa</strong> só pra rebuild total (lento).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!connectionStatus?.connected && (
            <div className="flex items-center gap-2 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <p className="text-sm">Conecte ao Bling primeiro para sincronizar produtos.</p>
            </div>
          )}

          <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
            <Switch
              id="skip-image-detail"
              checked={skipImageDetail}
              onCheckedChange={setSkipImageDetail}
              disabled={isSyncing}
            />
            <div className="space-y-0.5">
              <Label htmlFor="skip-image-detail" className="cursor-pointer">
                Modo rápido (sem buscar fotos HD)
              </Label>
              <p className="text-xs text-muted-foreground">
                Ative pra testar/debug. Em modo normal, fotos HD do Bling são baixadas só
                quando o produto é novo ou ainda não tem foto.
              </p>
            </div>
          </div>

          {isSyncing && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm space-y-1">
              <p>
                <strong>{progress.totalSynced}</strong> produtos sincronizados
                {progress.totalFailed > 0 && ` · ${progress.totalFailed} falhas`}
              </p>
              <p className="text-xs text-muted-foreground">
                {progress.totalImages} imagens · página {progress.currentPage} · modo {currentMode}
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              onClick={() => runSync('incremental')}
              disabled={!connectionStatus?.connected || isSyncing}
              size="lg"
              className="w-full"
            >
              {isSyncing && currentMode === 'incremental' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Sincronizar (só mudanças)
                </>
              )}
            </Button>
            <Button
              onClick={() => runSync('full')}
              disabled={!connectionStatus?.connected || isSyncing}
              variant="outline"
              size="lg"
              className="w-full"
            >
              {isSyncing && currentMode === 'full' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reconstruindo...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Forçar sync completa
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Como funciona a integração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>✅ <strong>Sync inteligente:</strong> só baixa produtos que mudaram no Bling desde a última sync, usando o filtro <code>dataAlteracaoInicial</code>.</p>
          <p>✅ <strong>Fotos HD:</strong> baixadas só quando o produto é novo ou está sem foto, ou no modo "forçar completa".</p>
          <p>✅ <strong>Rate limit safe:</strong> respeita 3 req/seg do Bling, com retry automático no 429.</p>
          <p>✅ <strong>Lotes:</strong> processa de 80 em 80 produtos pra nunca dar timeout.</p>
          <p>✅ <strong>WhatsApp:</strong> botão "Quero esse" abre WhatsApp com produto + dados do cliente já preenchidos.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminBlingPage;
