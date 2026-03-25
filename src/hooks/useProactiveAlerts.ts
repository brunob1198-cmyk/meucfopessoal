import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ProactiveAlert = {
  type: string;
  message: string;
  severity: 'warning' | 'danger' | 'info';
};

export function useProactiveAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<number>(0);

  const fetchAlerts = useCallback(async () => {
    if (!user) return;
    // Don't fetch more than once every 5 minutes
    if (Date.now() - lastFetch < 5 * 60 * 1000) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('bigb-chat', {
        body: { messages: [], mode: 'alerts' },
      });
      if (error) throw error;
      setAlerts(data?.alerts || []);
      setLastFetch(Date.now());
    } catch (e) {
      console.error('Failed to fetch proactive alerts:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user, lastFetch]);

  useEffect(() => {
    fetchAlerts();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissAlert = (index: number) => {
    setAlerts(prev => prev.filter((_, i) => i !== index));
  };

  return { alerts, isLoading, dismissAlert, refetch: fetchAlerts };
}
