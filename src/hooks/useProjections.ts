import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useProjections(startDate?: string, endDate?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['projections', user?.id, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from('projections')
        .select('*, categories(name, dre_type, parent_id)')
        .order('month');

      if (startDate) query = query.gte('month', startDate);
      if (endDate) query = query.lte('month', endDate);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useUpsertProjection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      category_id: string;
      month: string;
      amount: number;
    }) => {
      if (!user) throw new Error('Não autenticado');

      const monthValue = input.month.length === 7 ? input.month + '-01' : input.month;

      // Check if exists
      const { data: existing } = await supabase
        .from('projections')
        .select('id')
        .eq('user_id', user.id)
        .eq('category_id', input.category_id)
        .eq('month', monthValue)
        .maybeSingle();

      if (input.amount === 0) {
        // Delete if amount is 0
        if (existing) {
          await supabase.from('projections').delete().eq('id', existing.id);
        }
        return;
      }

      if (existing) {
        const { error } = await supabase
          .from('projections')
          .update({ amount: input.amount })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('projections')
          .insert({
            user_id: user.id,
            category_id: input.category_id,
            month: monthValue,
            amount: input.amount,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projections'] });
    },
    onError: (err: Error) => {
      toast.error('Erro ao salvar projeção: ' + err.message);
    },
  });
}

export function useBulkReplicateProjection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      category_id: string;
      amount: number;
      months: string[];
      notes?: string;
    }) => {
      if (!user) throw new Error('Não autenticado');

      const monthValues = input.months.map(m => (m.length === 7 ? m + '-01' : m));

      const { data: existing } = await supabase
        .from('projections')
        .select('id, month')
        .eq('user_id', user.id)
        .eq('category_id', input.category_id)
        .in('month', monthValues);

      const existingByMonth = new Map((existing || []).map(e => [e.month, e.id]));

      if (input.amount === 0) {
        const idsToDelete = monthValues
          .map(m => existingByMonth.get(m))
          .filter((id): id is string => !!id);
        if (idsToDelete.length > 0) {
          await supabase.from('projections').delete().in('id', idsToDelete);
        }
        return;
      }

      const rows = monthValues.map(month => ({
        id: existingByMonth.get(month),
        user_id: user.id,
        category_id: input.category_id,
        month,
        amount: input.amount,
        ...(input.notes !== undefined ? { notes: input.notes || null } : {}),
      }));

      const { error } = await supabase
        .from('projections')
        .upsert(rows, { onConflict: 'user_id,category_id,month' });
      if (error) throw error;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projections'] });
    },
    onError: (err: Error) => {
      toast.error('Erro: ' + err.message);
    },
  });
}
