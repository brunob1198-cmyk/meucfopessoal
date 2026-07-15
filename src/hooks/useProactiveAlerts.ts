import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ProactiveAlert = {
  type: string;
  message: string;
  severity: 'warning' | 'danger' | 'info';
};

const ALERTS_STORAGE_KEY = 'bigb-dismissed-alerts';

function getDismissedAlerts(): string[] {
  try {
    return JSON.parse(localStorage.getItem(ALERTS_STORAGE_KEY) || '[]');
  } catch { return []; }
}

function dismissAlertPermanently(alertMessage: string) {
  const dismissed = getDismissedAlerts();
  if (!dismissed.includes(alertMessage)) {
    dismissed.push(alertMessage);
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(dismissed));
  }
}

export function useProactiveAlerts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['proactive-alerts', user?.id],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return [];

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bigb-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: [], mode: 'alerts' }),
      });

      if (!resp.ok) throw new Error('Failed to fetch alerts');
      const data = await resp.json();
      return (data?.alerts || []) as ProactiveAlert[];
    },
    enabled: !!user,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const dismissedAlerts = getDismissedAlerts();
  const alerts = (query.data || []).filter(a => !dismissedAlerts.includes(a.message));

  const dismissAlert = (index: number) => {
    const alert = alerts[index];
    if (alert) {
      dismissAlertPermanently(alert.message);
      queryClient.setQueryData(['proactive-alerts', user?.id], (old: ProactiveAlert[] = []) =>
        old.filter(a => a.message !== alert.message)
      );
    }
  };

  return { alerts, isLoading: query.isLoading, dismissAlert, refetch: query.refetch };
}
