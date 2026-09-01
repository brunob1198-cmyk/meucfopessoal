import { useMemo } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { startOfMonth, endOfMonth, format, subMonths, startOfYear, endOfYear } from 'date-fns';
import { computeNetProfit } from '@/lib/dre';

interface MonthlyProfit {
  month: string;
  lucroLiquido: number;
  receita: number;
  despesas: number;
}

export function useDREIntegration() {
  // Fetch only the last 13 months (12 previous + current) — usado por tudo
  // abaixo, exceto accumulatedProfit, que precisa do histórico completo.
  const rangeStart = useMemo(() => format(startOfMonth(subMonths(new Date(), 12)), 'yyyy-MM-dd'), []);
  const rangeEnd = useMemo(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'), []);

  const { data: transactions = [], isLoading: loadingTx } = useTransactions(rangeStart, rangeEnd);
  const { data: categories = [], isLoading: loadingCat } = useCategories();

  // Busca à parte, sem limite de data, só para o "lucro acumulado total" —
  // a tela de Balanço Patrimonial soma esse valor ao patrimônio líquido e o
  // rotula como "Lucros Retidos (Total)", então precisa ser de fato o
  // histórico inteiro, não só os últimos 13 meses usados acima.
  const { data: allTimeTransactions = [], isLoading: loadingAllTime } = useTransactions();

  // Current month data
  const currentMonthData = useMemo(() => {
    const now = new Date();
    const start = format(startOfMonth(now), 'yyyy-MM-dd');
    const end = format(endOfMonth(now), 'yyyy-MM-dd');
    
    const monthTxs = transactions.filter(t => t.date >= start && t.date <= end);
    return computeNetProfit(monthTxs);
  }, [transactions]);

  // Previous month data
  const previousMonthData = useMemo(() => {
    const now = new Date();
    const prevMonth = subMonths(now, 1);
    const start = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(prevMonth), 'yyyy-MM-dd');
    
    const monthTxs = transactions.filter(t => t.date >= start && t.date <= end);
    return computeNetProfit(monthTxs);
  }, [transactions]);

  // Year-to-date accumulated profit
  const yearToDateProfit = useMemo(() => {
    const now = new Date();
    const start = format(startOfYear(now), 'yyyy-MM-dd');
    const end = format(endOfYear(now), 'yyyy-MM-dd');
    
    const yearTxs = transactions.filter(t => t.date >= start && t.date <= end);
    return computeNetProfit(yearTxs);
  }, [transactions]);

  // All-time accumulated profit (lucros retidos) — usa allTimeTransactions,
  // não a lista limitada a 13 meses.
  const accumulatedProfit = useMemo(() => {
    return computeNetProfit(allTimeTransactions);
  }, [allTimeTransactions]);

  // Monthly breakdown for charts
  const monthlyProfits = useMemo((): MonthlyProfit[] => {
    const now = new Date();
    const months: MonthlyProfit[] = [];
    
    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const start = format(startOfMonth(monthDate), 'yyyy-MM-dd');
      const end = format(endOfMonth(monthDate), 'yyyy-MM-dd');
      const monthLabel = format(monthDate, 'yyyy-MM');
      
      const monthTxs = transactions.filter(t => t.date >= start && t.date <= end);
      const data = computeNetProfit(monthTxs);
      
      months.push({
        month: monthLabel,
        lucroLiquido: data.lucroLiquido,
        receita: data.receitaBruta,
        despesas: data.despesas,
      });
    }
    
    return months;
  }, [transactions]);

  return {
    currentMonthProfit: currentMonthData.lucroLiquido,
    previousMonthProfit: previousMonthData.lucroLiquido,
    yearToDateProfit: yearToDateProfit.lucroLiquido,
    accumulatedProfit: accumulatedProfit.lucroLiquido,
    monthlyProfits,
    isLoading: loadingTx || loadingCat || loadingAllTime,
  };
}
