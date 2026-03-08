import { useState, useCallback } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

function parseMonth(m: string): Date {
  if (!m || m.length < 7) {
    return new Date();
  }
  const parts = m.split('-');
  const y = parseInt(parts[0], 10);
  const mo = parseInt(parts[1], 10);
  if (isNaN(y) || isNaN(mo) || mo < 1 || mo > 12) {
    return new Date();
  }
  return new Date(y, mo - 1, 1);
}

function isValidMonth(m: string): boolean {
  if (!m || m.length < 7) return false;
  const parts = m.split('-');
  if (parts.length !== 2) return false;
  const y = parseInt(parts[0], 10);
  const mo = parseInt(parts[1], 10);
  return !isNaN(y) && !isNaN(mo) && mo >= 1 && mo <= 12 && y >= 1900 && y <= 2100;
}

export function usePersistedFilter(pageKey: string) {
  const storageKey = `dre-filter-${pageKey}`;

  const getDefaultMonth = () => format(new Date(), 'yyyy-MM');

  const [range, setRange] = useState<{ start: string; end: string }>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (isValidMonth(parsed.start) && isValidMonth(parsed.end)) {
          return parsed;
        }
      }
    } catch {}
    const m = getDefaultMonth();
    return { start: m, end: m };
  });

  const setAndPersist = useCallback((start: string, end: string) => {
    // Validate inputs, fallback to current if invalid
    const validStart = isValidMonth(start) ? start : range.start;
    const validEnd = isValidMonth(end) ? end : range.end;
    
    const val = { start: validStart, end: validEnd };
    setRange(val);
    localStorage.setItem(storageKey, JSON.stringify(val));
  }, [storageKey, range]);

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
    setStartMonth: (m: string) => {
      if (!isValidMonth(m)) return;
      setAndPersist(m, range.end < m ? m : range.end);
    },
    setEndMonth: (m: string) => {
      if (!isValidMonth(m)) return;
      setAndPersist(range.start > m ? m : range.start, m);
    },
    setFullYear,
    parseMonth,
  };
}
