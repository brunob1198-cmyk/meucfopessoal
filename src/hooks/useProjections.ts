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

      // Check if exists
      const { data: existing } = await supabase
        .from('projections')
        .select('id')
        .eq('user_id', user.id)
        .eq('category_id', input.category_id)
        .eq('month', input.month + '-01')
        .maybeSingle();

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
            month: input.month + '-01',
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
      months: string[]; // ['2026-01', '2026-02', ...]
    }) => {
      if (!user) throw new Error('Não autenticado');

      for (const month of input.months) {
        const { data: existing } = await supabase
          .from('projections')
          .select('id')
          .eq('user_id', user.id)
          .eq('category_id', input.category_id)
          .eq('month', month + '-01')
          .maybeSingle();

        if (existing) {
          await supabase
            .from('projections')
            .update({ amount: input.amount })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('projections')
            .insert({
              user_id: user.id,
              category_id: input.category_id,
              month: month + '-01',
              amount: input.amount,
            });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projections'] });
      toast.success('Projeção replicada com sucesso!');
    },
    onError: (err: Error) => {
      toast.error('Erro: ' + err.message);
    },
  });
}
