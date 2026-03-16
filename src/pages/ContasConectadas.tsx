import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, CreditCard, RefreshCw, Trash2, Plus, Wifi, WifiOff,
  Clock, Landmark, ArrowDownUp, Loader2, ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ContasConectadas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['connected-accounts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('connected_accounts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: pendingCount } = useQuery({
    queryKey: ['pending-transactions-count', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('imported_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

  const loadPluggyScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if ((window as any).PluggyConnect) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.pluggy.ai/pluggy-connect/latest/pluggy-connect.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Falha ao carregar SDK do Pluggy'));
      document.head.appendChild(script);
    });
  };

  const connectBank = async () => {
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      // Get connect token from edge function
      const { data, error } = await supabase.functions.invoke('pluggy-connect', {
        body: { action: 'connect-token' },
      });

      if (error) throw new Error(error.message || 'Erro ao chamar função');

      const connectToken = data?.accessToken;
      if (!connectToken) throw new Error('Falha ao obter token de conexão');

      // Load Pluggy SDK and open widget
      await loadPluggyScript();

      const PluggyConnect = (window as any).PluggyConnect;
      if (!PluggyConnect) throw new Error('SDK do Pluggy não carregado');

      const pluggyConnect = new PluggyConnect({
        connectToken,
        includeSandbox: false,
        onSuccess: async (itemData: any) => {
          try {
            const itemId = itemData?.item?.id;
            if (!itemId) throw new Error('Item ID não retornado');

            // Fetch item details from our edge function
            const { data: fetchData, error: fetchError } = await supabase.functions.invoke(
              'pluggy-connect',
              { body: { action: 'fetch-item', itemId } }
            );
            if (fetchError) throw fetchError;

            // Save connected accounts
            for (const acc of fetchData.accounts || []) {
              await supabase.from('connected_accounts').insert({
                user_id: user!.id,
                pluggy_item_id: itemId,
                connector_name: fetchData.item?.connector?.name || 'Banco',
                connector_logo: fetchData.item?.connector?.imageUrl || null,
                account_type: acc.type === 'CREDIT' ? 'credit_card' : 'checking',
                account_name: acc.name || acc.number || 'Conta',
                balance: acc.balance || 0,
                last_sync_at: new Date().toISOString(),
                status: 'active',
              });
            }

            queryClient.invalidateQueries({ queryKey: ['connected-accounts'] });
            toast.success('Conta conectada com sucesso!');
          } catch (err: any) {
            toast.error('Erro ao salvar conta: ' + (err.message || 'Tente novamente'));
          } finally {
            setConnecting(false);
          }
        },
        onError: (error: any) => {
          console.error('Pluggy Connect error:', error);
          toast.error('Erro na conexão: ' + (error?.message || 'Tente novamente'));
          setConnecting(false);
        },
        onClose: () => {
          setConnecting(false);
        },
      });

      pluggyConnect.init();
    } catch (err: any) {
      toast.error('Erro ao conectar: ' + (err.message || 'Tente novamente'));
      setConnecting(false);
    }
  };

  const syncMutation = useMutation({
    mutationFn: async (account: any) => {
      const { data, error } = await supabase.functions.invoke(
        'pluggy-connect',
        {
          body: {
            action: 'sync-transactions',
            itemId: account.pluggy_item_id,
            accountId: account.pluggy_item_id,
            connectedAccountId: account.id,
          },
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['connected-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['pending-transactions-count'] });
      toast.success(`${data?.imported || 0} transações importadas!`);
    },
    onError: (err: Error) => toast.error('Erro na sincronização: ' + err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const account = accounts?.find((a) => a.id === accountId);
      if (account) {
        await supabase.functions.invoke('pluggy-connect', {
          body: { action: 'delete-item', itemId: account.pluggy_item_id },
        });
      }
      const { error } = await supabase.from('connected_accounts').delete().eq('id', accountId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connected-accounts'] });
      toast.success('Conta desconectada');
      setDeleteDialog(null);
    },
    onError: (err: Error) => toast.error('Erro: ' + err.message),
  });

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" />
            Contas Conectadas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Conecte suas contas bancárias via Open Finance para importar transações automaticamente.
          </p>
        </div>
        <div className="flex gap-2">
          {(pendingCount ?? 0) > 0 && (
            <Button variant="outline" asChild>
              <a href="/revisar-transacoes" className="flex items-center gap-2">
                <ArrowDownUp className="h-4 w-4" />
                Revisar ({pendingCount})
              </a>
            </Button>
          )}
          <Button onClick={connectBank} disabled={connecting} className="gap-2">
            {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Conectar banco
          </Button>
        </div>
      </div>

      {/* Security notice */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 py-4">
          <ShieldCheck className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Conexão segura via Open Finance</p>
            <p className="text-muted-foreground mt-0.5">
              Suas credenciais bancárias nunca são armazenadas. O acesso é feito exclusivamente via API regulamentada do Banco Central.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Accounts grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !accounts?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma conta conectada</h3>
            <p className="text-muted-foreground text-sm max-w-sm mb-6">
              Conecte suas contas bancárias e cartões de crédito para importar transações automaticamente.
            </p>
            <Button onClick={connectBank} disabled={connecting} className="gap-2">
              <Plus className="h-4 w-4" />
              Conectar primeiro banco
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {accounts.map((acc, i) => (
              <motion.div
                key={acc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="hover:border-primary/30 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {acc.connector_logo ? (
                          <img
                            src={acc.connector_logo}
                            alt={acc.connector_name}
                            className="h-10 w-10 rounded-lg object-contain bg-white p-1"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                            {acc.account_type === 'credit_card' ? (
                              <CreditCard className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <Building2 className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-sm">{acc.connector_name}</CardTitle>
                          <p className="text-xs text-muted-foreground">{acc.account_name}</p>
                        </div>
                      </div>
                      <Badge
                        variant={acc.status === 'active' ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {acc.status === 'active' ? (
                          <><Wifi className="h-3 w-3 mr-1" /> Ativa</>
                        ) : (
                          <><WifiOff className="h-3 w-3 mr-1" /> Inativa</>
                        )}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Saldo atual</p>
                      <p className="text-xl font-bold text-foreground">{fmt(acc.balance || 0)}</p>
                    </div>
                    {acc.last_sync_at && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Última sync: {format(new Date(acc.last_sync_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    )}
                    <div className="flex gap-2 pt-2 border-t border-border/50">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1"
                        onClick={() => syncMutation.mutate(acc)}
                        disabled={syncMutation.isPending}
                      >
                        <RefreshCw className={`h-3 w-3 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                        Sincronizar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteDialog(acc.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desconectar conta</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja desconectar esta conta? As transações já importadas serão mantidas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => deleteDialog && deleteMutation.mutate(deleteDialog)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Desconectar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
