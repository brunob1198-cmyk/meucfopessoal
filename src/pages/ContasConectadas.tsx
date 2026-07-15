import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, CreditCard, RefreshCw, Trash2, Plus, Wifi, WifiOff,
  Clock, Landmark, ArrowDownUp, Loader2, ShieldCheck, AlertCircle, CheckCircle2, Zap,
  Wallet, Receipt
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AUTO_SYNC_COOLDOWN_KEY = 'contas-last-autosync';
const AUTO_SYNC_COOLDOWN_MS = 15 * 60 * 1000;


export default function ContasConectadas() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null);
  const [syncingAccounts, setSyncingAccounts] = useState<Set<string>>(new Set());
  const autoSyncDone = useRef(false);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['connected-accounts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('connected_accounts')
        .select('*')
        .order('account_type', { ascending: true })
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

  // Auto-sync on page open — sync by unique item to cover all accounts
  useEffect(() => {
    if (accounts?.length && !autoSyncDone.current) {
      autoSyncDone.current = true;
      // Get unique items
      const itemIds = [...new Set(accounts.map(a => a.pluggy_item_id))];
      if (itemIds.length > 0) {
        toast.info('Sincronizando contas automaticamente...');
        (async () => {
          for (const itemId of itemIds) {
            try {
              await syncByItem(itemId);
            } catch {
              // Individual errors handled inside
            }
            await new Promise(r => setTimeout(r, 1000));
          }
          queryClient.invalidateQueries({ queryKey: ['connected-accounts'] });
          queryClient.invalidateQueries({ queryKey: ['pending-transactions-count'] });
        })();
      }
    }
  }, [accounts]);

  /** Sync all accounts for a given Pluggy item */
  const syncByItem = async (itemId: string) => {
    // Mark all accounts of this item as syncing in UI
    const itemAccounts = accounts?.filter(a => a.pluggy_item_id === itemId) || [];
    setSyncingAccounts(prev => {
      const next = new Set(prev);
      itemAccounts.forEach(a => next.add(a.id));
      return next;
    });

    try {
      const { data, error } = await supabase.functions.invoke('pluggy-connect', {
        body: {
          action: 'sync-transactions',
          itemId,
        },
      });
      if (error) throw error;
      toast.success(
        `${data?.accountsSynced || 0} conta(s) sincronizada(s): ${data?.imported || 0} transações`
      );
      queryClient.invalidateQueries({ queryKey: ['connected-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['pending-transactions-count'] });
      return data;
    } catch (err: any) {
      toast.error(`Erro ao sincronizar: ${err.message}`);
      throw err;
    } finally {
      setSyncingAccounts(prev => {
        const next = new Set(prev);
        itemAccounts.forEach(a => next.delete(a.id));
        return next;
      });
    }
  };

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      if (!accounts?.length) return;
      const itemIds = [...new Set(accounts.map(a => a.pluggy_item_id))];
      for (const itemId of itemIds) {
        try {
          await syncByItem(itemId);
        } catch {
          // Continue with next
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    },
  });

  const registerWebhookMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('pluggy-connect', {
        body: { action: 'register-webhook' },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => toast.success('Webhook registrado com sucesso!'),
    onError: (err: Error) => toast.error('Erro ao registrar webhook: ' + err.message),
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

      const { data, error } = await supabase.functions.invoke('pluggy-connect', {
        body: { action: 'connect-token' },
      });

      if (error) throw new Error(error.message || 'Erro ao chamar função');

      const connectToken = data?.accessToken;
      if (!connectToken) throw new Error('Falha ao obter token de conexão');

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

            const { data: fetchData, error: fetchError } = await supabase.functions.invoke(
              'pluggy-connect',
              { body: { action: 'fetch-item', itemId } }
            );
            if (fetchError) throw fetchError;

            // Create a connected_account for EACH Pluggy account (checking + credit card)
            for (const acc of fetchData.accounts || []) {
              const accountType = (acc.type || '').toUpperCase();
              const mappedType = accountType === 'CREDIT' || accountType === 'CREDIT_CARD'
                ? 'credit_card'
                : accountType === 'SAVINGS' ? 'savings' : 'checking';

              const creditData = acc.creditData || acc.creditCardData || {};

              await supabase.from('connected_accounts').insert({
                user_id: user!.id,
                pluggy_item_id: itemId,
                pluggy_account_id: acc.id,
                connector_name: fetchData.item?.connector?.name || 'Banco',
                connector_logo: fetchData.item?.connector?.imageUrl || null,
                account_type: mappedType,
                account_name: acc.name || acc.number || (mappedType === 'credit_card' ? 'Cartão de Crédito' : 'Conta'),
                balance: mappedType === 'credit_card'
                  ? (creditData.availableCreditLimit ?? creditData.creditLimit ?? 0)
                  : (acc.balance || 0),
                credit_limit: mappedType === 'credit_card'
                  ? (creditData.creditLimit ?? creditData.availableCreditLimit ?? 0)
                  : 0,
                credit_bill_amount: mappedType === 'credit_card'
                  ? Math.abs(acc.balance || 0)
                  : 0,
                last_sync_at: new Date().toISOString(),
                status: 'active',
              });
            }

            queryClient.invalidateQueries({ queryKey: ['connected-accounts'] });
            toast.success('Conta conectada com sucesso!');

            // Auto-register webhook after first connection
            registerWebhookMutation.mutate();
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

  const deleteMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const account = accounts?.find((a) => a.id === accountId);
      if (account) {
        // Check if this is the last account for this item — if so, delete from Pluggy too
        const otherAccounts = accounts?.filter(
          a => a.pluggy_item_id === account.pluggy_item_id && a.id !== accountId
        );
        if (!otherAccounts?.length) {
          await supabase.functions.invoke('pluggy-connect', {
            body: { action: 'delete-item', itemId: account.pluggy_item_id },
          });
        }
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

  const getStatusBadge = (status: string, isSyncing: boolean) => {
    if (isSyncing) {
      return (
        <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Sincronizando
        </Badge>
      );
    }
    switch (status) {
      case 'active':
        return (
          <Badge variant="default" className="text-[10px]">
            <Wifi className="h-3 w-3 mr-1" /> Ativa
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="text-[10px]">
            <AlertCircle className="h-3 w-3 mr-1" /> Erro
          </Badge>
        );
      case 'syncing':
        return (
          <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Sincronizando
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-[10px]">
            <WifiOff className="h-3 w-3 mr-1" /> Inativa
          </Badge>
        );
    }
  };

  // Group accounts by type for display
  const checkingAccounts = accounts?.filter(a => a.account_type === 'checking' || a.account_type === 'savings') || [];
  const creditAccounts = accounts?.filter(a => a.account_type === 'credit_card') || [];

  const renderAccountCard = (acc: any, i: number) => {
    const isSyncing = syncingAccounts.has(acc.id) || acc.status === 'syncing';
    const isCreditCard = acc.account_type === 'credit_card';

    return (
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
                    {isCreditCard ? (
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                )}
                <div>
                  <CardTitle className="text-sm">{acc.connector_name}</CardTitle>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {isCreditCard ? (
                      <><CreditCard className="h-3 w-3" /> {acc.account_name}</>
                    ) : (
                      <><Wallet className="h-3 w-3" /> {acc.account_name}</>
                    )}
                  </p>
                </div>
              </div>
              {getStatusBadge(acc.status, isSyncing)}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isCreditCard ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CreditCard className="h-3 w-3" /> Limite
                    </p>
                    <p className="text-lg font-bold text-foreground">
                      {fmt((acc as any).credit_limit || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Receipt className="h-3 w-3" /> Fatura atual
                    </p>
                    <p className="text-lg font-bold text-destructive">
                      {fmt((acc as any).credit_bill_amount || 0)}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Wallet className="h-3 w-3" /> Saldo conta corrente
                </p>
                <p className="text-xl font-bold text-foreground">{fmt(acc.balance || 0)}</p>
              </div>
            )}
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
                onClick={() => syncByItem(acc.pluggy_item_id)}
                disabled={isSyncing}
              >
                <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
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
    );
  };

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
            Conecte suas contas bancárias e cartões de crédito via Open Finance para importar transações automaticamente.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(pendingCount ?? 0) > 0 && (
            <Button variant="outline" asChild>
              <a href="/revisar-transacoes" className="flex items-center gap-2">
                <ArrowDownUp className="h-4 w-4" />
                Revisar ({pendingCount})
              </a>
            </Button>
          )}
          {accounts && accounts.length > 0 && (
            <Button
              variant="outline"
              onClick={() => syncAllMutation.mutate()}
              disabled={syncAllMutation.isPending || syncingAccounts.size > 0}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${syncAllMutation.isPending ? 'animate-spin' : ''}`} />
              Sincronizar todas
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
              Sincronização automática ativada: ao abrir esta página suas contas são atualizadas.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Webhook registration card */}
      {accounts && accounts.length > 0 && (
        <Card className="border-accent/30">
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-accent-foreground" />
              <span className="text-muted-foreground">
                Ative o webhook para receber atualizações em tempo real do banco.
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => registerWebhookMutation.mutate()}
              disabled={registerWebhookMutation.isPending}
              className="gap-1"
            >
              {registerWebhookMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3 w-3" />
              )}
              Ativar Webhook
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Accounts */}
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
        <div className="space-y-6">
          {/* Checking accounts section */}
          {checkingAccounts.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
                <Wallet className="h-5 w-5 text-primary" />
                Contas Correntes
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {checkingAccounts.map((acc, i) => renderAccountCard(acc, i))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Credit card accounts section */}
          {creditAccounts.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
                <CreditCard className="h-5 w-5 text-primary" />
                Cartões de Crédito
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {creditAccounts.map((acc, i) => renderAccountCard(acc, i))}
                </AnimatePresence>
              </div>
            </div>
          )}
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
