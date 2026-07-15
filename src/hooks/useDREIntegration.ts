import { useMemo } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { startOfMonth, endOfMonth, format, subMonths, startOfYear, endOfYear } from 'date-fns';

interface MonthlyProfit {
  month: string;
  lucroLiquido: number;
  receita: number;
  despesas: number;
}

export function useDREIntegration() {
  // Fetch only the last 13 months (12 previous + current) — max window used below
  const rangeStart = useMemo(() => format(startOfMonth(subMonths(new Date(), 12)), 'yyyy-MM-dd'), []);
  const rangeEnd = useMemo(() => format(endOfMonth(new Date()), 'yyyy-MM-dd'), []);

  const { data: transactions = [], isLoading: loadingTx } = useTransactions(rangeStart, rangeEnd);
  const { data: categories = [], isLoading: loadingCat } = useCategories();

  const computeNetProfit = (txs: typeof transactions) => {
    const sumByType = (type: string) =>
      txs
        .filter((t) => t.categories?.dre_type === type)
        .reduce((sum, t) => sum + Number(t.amount), 0);

    const receitaBruta = sumByType('receita');
    const descontos = sumByType('desconto');
    const receitaLiquida = receitaBruta - descontos;
    const custos = sumByType('custo');
    const lucroBruto = receitaLiquida - custos;
    const despesas = sumByType('despesa');
    const ebitda = lucroBruto - despesas;
    const depreciacao = sumByType('depreciacao');
    const ebit = ebitda - depreciacao;
    const resultadoFinanceiro = sumByType('resultado_financeiro');
    const outrasReceitas = sumByType('outras_receitas');
    const lair = ebit + resultadoFinanceiro + outrasReceitas;
    const impostos = sumByType('impostos');
    const lucroLiquido = lair - impostos;

    return {
      receitaBruta,
      despesas,
      lucroLiquido,
    };
  };

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

  // All-time accumulated profit (lucros retidos)
  const accumulatedProfit = useMemo(() => {
    return computeNetProfit(transactions);
  }, [transactions]);

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
    isLoading: loadingTx || loadingCat,
  };
}
