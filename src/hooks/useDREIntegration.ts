import { useMemo } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { startOfMonth, endOfMonth, format, subMonths, startOfYear } from 'date-fns';
import { computeNetProfit, computeDRELucroLiquido } from '@/lib/dre';

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

  // Current month data — mesma fórmula da DRE (computeDRELucroLiquido): investimento
  // conta como saída/despesa e o resultado financeiro é separado por categoria-pai,
  // então o valor bate com a linha "(=) LUCRO LÍQUIDO" da DRE para o mesmo período.
  const currentMonthProfit = useMemo(() => {
    const now = new Date();
    const start = format(startOfMonth(now), 'yyyy-MM-dd');
    const end = format(endOfMonth(now), 'yyyy-MM-dd');

    const monthTxs = transactions.filter(t => t.date >= start && t.date <= end);
    return computeDRELucroLiquido(monthTxs, categories);
  }, [transactions, categories]);

  // Previous month data
  const previousMonthProfit = useMemo(() => {
    const now = new Date();
    const prevMonth = subMonths(now, 1);
    const start = format(startOfMonth(prevMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(prevMonth), 'yyyy-MM-dd');

    const monthTxs = transactions.filter(t => t.date >= start && t.date <= end);
    return computeDRELucroLiquido(monthTxs, categories);
  }, [transactions, categories]);

  // Year-to-date accumulated profit — vai de 1º de janeiro até HOJE (não até o fim
  // do ano), para não misturar lançamentos futuros/projetados do mês em curso ou de
  // meses seguintes no "acumulado".
  const yearToDateProfit = useMemo(() => {
    const now = new Date();
    const start = format(startOfYear(now), 'yyyy-MM-dd');
    const end = format(now, 'yyyy-MM-dd');

    const yearTxs = transactions.filter(t => t.date >= start && t.date <= end);
    return computeDRELucroLiquido(yearTxs, categories);
  }, [transactions, categories]);

  // All-time accumulated profit (lucros retidos) — usa allTimeTransactions,
  // não a lista limitada a 13 meses.
  const accumulatedProfit = useMemo(() => {
    return computeDRELucroLiquido(allTimeTransactions, categories);
  }, [allTimeTransactions, categories]);

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
      const { receitaBruta, despesas } = computeNetProfit(monthTxs);

      months.push({
        month: monthLabel,
        lucroLiquido: computeDRELucroLiquido(monthTxs, categories),
        receita: receitaBruta,
        despesas,
      });
    }

    return months;
  }, [transactions, categories]);

  return {
    currentMonthProfit,
    previousMonthProfit,
    yearToDateProfit,
    accumulatedProfit,
    monthlyProfits,
    isLoading: loadingTx || loadingCat || loadingAllTime,
  };
}
