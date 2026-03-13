import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCategories } from '@/hooks/useCategories';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownUp, Check, CheckCheck, X, Edit2, Loader2, Filter,
  ArrowUpCircle, ArrowDownCircle, CreditCard, RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function RevisarTransacoes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: categories } = useCategories();
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed'>('pending');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState<string>('');

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['imported-transactions', user?.id, filter],
    queryFn: async () => {
      let query = supabase
        .from('imported_transactions')
        .select('*, connected_accounts(connector_name, connector_logo)')
        .order('date', { ascending: false });

      if (filter === 'pending') query = query.eq('status', 'pending');
      if (filter === 'confirmed') query = query.eq('status', 'confirmed');

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Leaf categories only
  const leafCategories = useMemo(() => {
    if (!categories) return [];
    const parentIds = new Set(categories.filter((c) => c.parent_id).map((c) => c.parent_id));
    return categories.filter((c) => !parentIds.has(c.id) || c.parent_id);
  }, [categories]);

  const confirmMutation = useMutation({
    mutationFn: async ({ id, categoryId }: { id: string; categoryId: string }) => {
      const { error } = await supabase
        .from('imported_transactions')
        .update({ confirmed_category_id: categoryId, status: 'confirmed' })
        .eq('id', id);
      if (error) throw error;

      // Save category rule for learning
      const tx = transactions?.find((t) => t.id === id);
      if (tx?.description && user) {
        // Extract first meaningful word as keyword
        const keyword = tx.description.split(/\s+/)[0]?.toUpperCase();
        if (keyword && keyword.length > 2) {
          await supabase
            .from('category_rules')
            .upsert(
              { user_id: user.id, keyword, category_id: categoryId },
              { onConflict: 'user_id,keyword' as any, ignoreDuplicates: true }
            );
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imported-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['pending-transactions-count'] });
      setEditingId(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const confirmBatchMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const tx = transactions?.find((t) => t.id === id);
        const catId = tx?.suggested_category_id;
        if (!catId) continue;
        await supabase
          .from('imported_transactions')
          .update({ confirmed_category_id: catId, status: 'confirmed' })
          .eq('id', id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imported-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['pending-transactions-count'] });
      setSelected(new Set());
      toast.success('Transações confirmadas!');
    },
  });

  const convertToTransactionsMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Não autenticado');
      const confirmed = transactions?.filter((t) => t.status === 'confirmed' && t.confirmed_category_id);
      if (!confirmed?.length) throw new Error('Nenhuma transação confirmada para converter');

      const rows = confirmed.map((t) => ({
        user_id: user.id,
        category_id: t.confirmed_category_id!,
        amount: t.transaction_type === 'credit' ? t.amount : -Math.abs(t.amount),
        date: t.date,
        payment_date: t.date,
        comment: t.description || 'Importado via Open Finance',
      }));

      const { error: insertErr } = await supabase.from('transactions').insert(rows);
      if (insertErr) throw insertErr;

      // Mark as processed
      const ids = confirmed.map((t) => t.id);
      await supabase
        .from('imported_transactions')
        .update({ status: 'processed' })
        .in('id', ids);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imported-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['pending-transactions-count'] });
      toast.success('Transações enviadas para o DRE!');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('imported_transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imported-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['pending-transactions-count'] });
    },
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!transactions) return;
    if (selected.size === transactions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(transactions.map((t) => t.id)));
    }
  };

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const getCategoryName = (catId: string | null) => {
    if (!catId || !categories) return null;
    return categories.find((c) => c.id === catId)?.name;
  };

  const typeIcons: Record<string, any> = {
    credit: <ArrowUpCircle className="h-4 w-4 text-emerald-400" />,
    debit: <ArrowDownCircle className="h-4 w-4 text-red-400" />,
    credit_card: <CreditCard className="h-4 w-4 text-amber-400" />,
  };

  const pendingWithSuggestion = transactions?.filter(
    (t) => t.status === 'pending' && t.suggested_category_id
  );
  const confirmedCount = transactions?.filter((t) => t.status === 'confirmed').length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ArrowDownUp className="h-6 w-6 text-primary" />
            Revisar Transações
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Revise e categorize transações importadas via Open Finance.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(pendingWithSuggestion?.length ?? 0) > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() =>
                confirmBatchMutation.mutate(
                  pendingWithSuggestion!.map((t) => t.id)
                )
              }
              disabled={confirmBatchMutation.isPending}
            >
              <CheckCheck className="h-4 w-4" />
              Confirmar todas sugeridas ({pendingWithSuggestion?.length})
            </Button>
          )}
          {confirmedCount > 0 && (
            <Button
              size="sm"
              className="gap-1"
              onClick={() => convertToTransactionsMutation.mutate()}
              disabled={convertToTransactionsMutation.isPending}
            >
              {convertToTransactionsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Enviar para DRE ({confirmedCount})
            </Button>
          )}
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="confirmed">Confirmadas</SelectItem>
            <SelectItem value="all">Todas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Transaction list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !transactions?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ArrowDownUp className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {filter === 'pending' ? 'Nenhuma transação pendente' : 'Nenhuma transação encontrada'}
            </h3>
            <p className="text-muted-foreground text-sm">
              Sincronize suas contas para importar transações.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {transactions.length} transaç{transactions.length === 1 ? 'ão' : 'ões'}
              </CardTitle>
              {transactions.length > 1 && (
                <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs">
                  {selected.size === transactions.length ? 'Desmarcar todas' : 'Selecionar todas'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              <AnimatePresence>
                {transactions.map((tx) => {
                  const suggestedName = getCategoryName(tx.suggested_category_id);
                  const confirmedName = getCategoryName(tx.confirmed_category_id);
                  const isEditing = editingId === tx.id;

                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <Checkbox
                        checked={selected.has(tx.id)}
                        onCheckedChange={() => toggleSelect(tx.id)}
                      />

                      <div className="flex-shrink-0">{typeIcons[tx.transaction_type] || typeIcons.debit}</div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {tx.description || 'Sem descrição'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(tx.date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                          {(tx as any).connected_accounts?.connector_name && (
                            <span className="text-xs text-muted-foreground">
                              • {(tx as any).connected_accounts.connector_name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Category */}
                      <div className="flex-shrink-0 w-44">
                        {isEditing ? (
                          <Select
                            value={editCategory}
                            onValueChange={(v) => {
                              setEditCategory(v);
                              confirmMutation.mutate({ id: tx.id, categoryId: v });
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {leafCategories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id} className="text-xs">
                                  {cat.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : tx.status === 'confirmed' && confirmedName ? (
                          <Badge variant="secondary" className="text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            {confirmedName}
                          </Badge>
                        ) : suggestedName ? (
                          <Badge variant="outline" className="text-xs text-amber-400 border-amber-400/30">
                            {suggestedName}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Sem categoria</span>
                        )}
                      </div>

                      {/* Amount */}
                      <div className="flex-shrink-0 text-right w-28">
                        <span
                          className={`text-sm font-semibold ${
                            tx.transaction_type === 'credit' ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {tx.transaction_type === 'credit' ? '+' : '-'}
                          {fmt(Math.abs(tx.amount))}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 flex-shrink-0">
                        {tx.status === 'pending' && suggestedName && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-emerald-400 hover:text-emerald-300"
                            onClick={() =>
                              confirmMutation.mutate({
                                id: tx.id,
                                categoryId: tx.suggested_category_id!,
                              })
                            }
                            title="Confirmar sugestão"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingId(tx.id);
                            setEditCategory(tx.confirmed_category_id || tx.suggested_category_id || '');
                          }}
                          title="Alterar categoria"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(tx.id)}
                          title="Remover"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
