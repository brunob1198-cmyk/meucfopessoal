import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ProactiveAlert = {
  type: string;
  message: string;
  severity: 'warning' | 'danger' | 'info';
};

const ALERTS_STORAGE_KEY = 'bigb-dismissed-alerts';
const ALERTS_FETCH_KEY = 'bigb-last-alert-fetch';

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
  const [alerts, setAlerts] = useState<ProactiveAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    if (!user) return;

    // Don't fetch more than once every 30 minutes
    const lastFetch = parseInt(localStorage.getItem(ALERTS_FETCH_KEY) || '0', 10);
    if (Date.now() - lastFetch < 30 * 60 * 1000) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;

    setIsLoading(true);
    try {
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
      const allAlerts: ProactiveAlert[] = data?.alerts || [];
      const dismissed = getDismissedAlerts();
      const filtered = allAlerts.filter(a => !dismissed.includes(a.message));
      setAlerts(filtered);
      localStorage.setItem(ALERTS_FETCH_KEY, String(Date.now()));
    } catch (e) {
      console.error('Failed to fetch proactive alerts:', e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAlerts();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissAlert = (index: number) => {
    const alert = alerts[index];
    if (alert) {
      dismissAlertPermanently(alert.message);
    }
    setAlerts(prev => prev.filter((_, i) => i !== index));
  };

  return { alerts, isLoading, dismissAlert, refetch: fetchAlerts };
}
