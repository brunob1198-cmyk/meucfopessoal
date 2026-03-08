import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type PlanType = 'free' | 'premium';

export function useUserPlan() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['user-plan', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_plans')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const plan: PlanType = (data?.plan as PlanType) || 'free';
  const isPremium = plan === 'premium';

  return { plan, isPremium, isLoading };
}

export function useTransactionCount(month?: string) {
  const { user } = useAuth();
  const currentMonth = month || new Date().toISOString().substring(0, 7);
  const startDate = `${currentMonth}-01`;
  const endDate = `${currentMonth}-31`;

  return useQuery({
    queryKey: ['tx-count', user?.id, currentMonth],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .gte('date', startDate)
        .lte('date', endDate);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });
}

export const FREE_TX_LIMIT = 100;
