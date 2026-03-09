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

      for (const month of input.months) {
        const monthValue = month.length === 7 ? month + '-01' : month;

        const { data: existing } = await supabase
          .from('projections')
          .select('id')
          .eq('user_id', user.id)
          .eq('category_id', input.category_id)
          .eq('month', monthValue)
          .maybeSingle();

        if (input.amount === 0) {
          if (existing) {
            await supabase.from('projections').delete().eq('id', existing.id);
          }
          continue;
        }

        if (existing) {
          await supabase
            .from('projections')
            .update({ amount: input.amount, ...(input.notes !== undefined ? { notes: input.notes || null } : {}) })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('projections')
            .insert({
              user_id: user.id,
              category_id: input.category_id,
              month: monthValue,
              amount: input.amount,
              notes: input.notes || null,
            });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projections'] });
    },
    onError: (err: Error) => {
      toast.error('Erro: ' + err.message);
    },
  });
}
