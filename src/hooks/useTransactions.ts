import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { addMonths, format } from 'date-fns';
import { parseLocalDate } from '@/lib/utils';

export function useTransactions(startDate?: string, endDate?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['transactions', user?.id, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select('*, categories(name, dre_type, parent_id)')
        .order('date', { ascending: false });

      if (startDate) query = query.gte('date', startDate);
      if (endDate) query = query.lte('date', endDate);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateTransaction() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      category_id: string;
      amount: number;
      date: string;
      payment_date?: string;
      comment?: string;
      is_installment?: boolean;
      total_installments?: number;
    }) => {
      if (!user) throw new Error('Não autenticado');

      if (input.is_installment && input.total_installments && input.total_installments > 1) {
        const installmentGroup = crypto.randomUUID();
        const installmentAmount = Number((input.amount / input.total_installments).toFixed(2));
        const rows = Array.from({ length: input.total_installments }, (_, i) => ({
          user_id: user.id,
          category_id: input.category_id,
          amount: installmentAmount,
          date: format(addMonths(parseLocalDate(input.date), i), 'yyyy-MM-dd'),
          comment: input.comment || null,
          is_installment: true,
          installment_group: installmentGroup,
          installment_number: i + 1,
          total_installments: input.total_installments,
        }));

        const { error } = await supabase.from('transactions').insert(rows);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        category_id: input.category_id,
        amount: input.amount,
        date: input.date,
        comment: input.comment || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Lançamento salvo!');
    },
    onError: (err: Error) => {
      toast.error('Erro ao salvar: ' + err.message);
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { comment?: string; amount?: number; date?: string } }) => {
      const { error } = await supabase.from('transactions').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Lançamento atualizado');
    },
    onError: (err: Error) => {
      toast.error('Erro ao atualizar: ' + err.message);
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Lançamento excluído');
    },
  });
}
