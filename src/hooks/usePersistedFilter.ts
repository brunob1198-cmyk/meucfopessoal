import { useState, useCallback } from 'react';
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth } from 'date-fns';

function parseMonth(m: string): Date {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1);
}

export function usePersistedFilter(pageKey: string) {
  const storageKey = `dre-filter-${pageKey}`;

  const [range, setRange] = useState<{ start: string; end: string }>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    const now = new Date();
    const m = format(now, 'yyyy-MM');
    return { start: m, end: m };
  });

  const setAndPersist = useCallback((start: string, end: string) => {
    const val = { start, end };
    setRange(val);
    localStorage.setItem(storageKey, JSON.stringify(val));
  }, [storageKey]);

  const startDate = format(startOfMonth(parseMonth(range.start)), 'yyyy-MM-dd');
  const endDate = format(endOfMonth(parseMonth(range.end)), 'yyyy-MM-dd');

  const setFullYear = useCallback((year?: number) => {
    const y = year ?? new Date().getFullYear();
    setAndPersist(`${y}-01`, `${y}-12`);
  }, [setAndPersist]);

  return {
    startMonth: range.start,
    endMonth: range.end,
    startDate,
    endDate,
    setStartMonth: (m: string) => setAndPersist(m, range.end < m ? m : range.end),
    setEndMonth: (m: string) => setAndPersist(range.start > m ? m : m, m),
    setFullYear,
    parseMonth,
  };
}
