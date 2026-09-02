import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useAssets, useLiabilities } from '@/hooks/useBalanceSheet';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import {
  type PillarScore, getClassification, getDespesasFinanceiras,
  scoreLiquidez, scoreControleGastos, scoreEndividamento, scoreReservaEmergencia, scoreCapacidadePoupanca,
} from '@/lib/financialHealthScore';

export type { PillarScore };

export interface ScoreHistorySnapshot {
  id: string;
  user_id: string;
  month: string;
  total_score: number;
  liquidez_score: number;
  controle_gastos_score: number;
  endividamento_score: number;
  reserva_emergencia_score: number;
  capacidade_poupanca_score: number;
  created_at: string;
}

// Snapshot mensal do score, mesmo padrão de useNetWorthHistory
// (src/hooks/useBalanceSheet.ts) — alimenta o gráfico de evolução.
// `financial_health_score_history` ainda não está nos tipos gerados do
// Supabase (migration nova, pendente de aplicação e de `supabase gen
// types`) — usa `as any` no client até a tabela existir de fato e os tipos
// serem regenerados.
export function useFinancialHealthScoreHistory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['financial-health-score-history', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('financial_health_score_history')
        .select('*')
        .order('month', { ascending: true });
      if (error) throw error;
      return data as ScoreHistorySnapshot[];
    },
    enabled: !!user,
  });

  const saveSnapshot = useMutation({
    mutationFn: async (snapshot: Omit<ScoreHistorySnapshot, 'id' | 'user_id' | 'created_at'>) => {
      const { error } = await (supabase as any)
        .from('financial_health_score_history')
        .upsert({ ...snapshot, user_id: user!.id }, { onConflict: 'user_id,month' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['financial-health-score-history'] }),
  });

  return { ...query, saveSnapshot };
}

export interface FinancialHealthScore {
  total: number;
  classification: string;
  classificationColor: string;
  pillars: PillarScore[];
  recommendations: string[];
  isLoading: boolean;
}

export function useFinancialHealthScore(): FinancialHealthScore {
  // Usa os últimos 3 meses FECHADOS (exclui o mês corrente, que estaria
  // incompleto) — assim a divisão fixa por `months = 3` abaixo nunca subestima
  // a média, independente de qual dia do mês for hoje.
  const now = new Date();
  const startOfRange = startOfMonth(subMonths(now, 3));
  const endOfRange = endOfMonth(subMonths(now, 1));
  const startDate = format(startOfRange, 'yyyy-MM-dd');
  const endDate = format(endOfRange, 'yyyy-MM-dd');

  const { data: transactions = [], isLoading: txLoading } = useTransactions(startDate, endDate);
  const { data: categories = [], isLoading: catLoading } = useCategories();
  const { data: assets = [], isLoading: assetsLoading } = useAssets();
  const { data: liabilities = [], isLoading: liabLoading } = useLiabilities();

  const isLoading = txLoading || catLoading || assetsLoading || liabLoading;

  const result = useMemo(() => {
    const txArr = transactions as any[];
    const catArr = categories as any[];

    // --- Income & Expenses (average monthly over 3 months) ---
    const months = 3;

    const sumByDreType = (type: string) =>
      txArr
        .filter((t) => t.categories?.dre_type === type)
        .reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0);

    const totalReceita = sumByDreType('receita') + sumByDreType('outras_receitas');
    const totalDescontos = sumByDreType('desconto');
    const totalCustos = sumByDreType('custo');
    const totalDespesas = sumByDreType('despesa');
    const totalImpostos = sumByDreType('impostos');
    const totalDespesasFinanceiras = getDespesasFinanceiras(txArr, catArr);
    // 'investimento' NÃO entra em totalGastos de propósito: aqui ele soma como
    // poupança no Pilar 5 (avgInvestimentos), diferente do DRE (src/lib/dre.ts),
    // que trata investimento como despesa. São leituras intencionalmente
    // diferentes do mesmo lançamento: o DRE mede lucro operacional do período
    // (investir reduz o caixa disponível); o Score mede capacidade de poupança
    // pessoal (investir é o objetivo, não um gasto).
    const totalInvestimentos = sumByDreType('investimento');

    // 'depreciacao' fica de fora de propósito: é lançamento contábil, não sai
    // do seu caixa, então não deveria reduzir a liquidez/reserva percebida.
    const receitaLiquidaTotal = totalReceita - totalDescontos;
    const totalGastos = totalDespesas + totalCustos + totalImpostos + totalDespesasFinanceiras;

    const avgReceita = receitaLiquidaTotal / months;
    const avgDespesas = totalGastos / months;
    const avgInvestimentos = totalInvestimentos / months;

    // --- Balance Sheet ---
    const assetsArr = assets as any[];
    const liabArr = liabilities as any[];

    // Categorias sem sobreposição: Liquidez mede dinheiro imediato (conta
    // corrente/caixa); Reserva de Emergência mede poupança/renda fixa/fundos.
    // Cada saldo entra em exatamente um dos dois pilares, nunca nos dois.
    const liquidCategories = ['conta_corrente', 'dinheiro_caixa'];
    const emergencyCategories = ['poupanca', 'renda_fixa', 'fundos'];

    const liquidAssets = assetsArr
      .filter((a) => liquidCategories.includes(a.category))
      .reduce((s: number, a: any) => s + Number(a.current_value), 0);

    const emergencyReserve = assetsArr
      .filter((a) => emergencyCategories.includes(a.category))
      .reduce((s: number, a: any) => s + Number(a.current_value), 0);

    const totalMonthlyDebt = liabArr
      .reduce((s: number, l: any) => s + Number(l.monthly_payment || 0), 0);

    // =====================
    // PILAR 1 — Liquidez
    // =====================
    const monthsCovered = avgDespesas > 0 ? liquidAssets / avgDespesas : 0;
    const liquidezScore = scoreLiquidez(monthsCovered);

    const liquidezPillar: PillarScore = {
      name: 'Liquidez',
      score: liquidezScore,
      max: 20,
      indicator: 'Meses de despesas cobertos',
      indicatorValue: `${monthsCovered.toFixed(1)} meses`,
      insight:
        avgDespesas === 0
          ? 'Sem histórico de despesas nos últimos 3 meses — lance seus gastos para avaliar este pilar.'
          : monthsCovered >= 6
          ? 'Excelente liquidez. Suas reservas líquidas cobrem mais de 6 meses de despesas.'
          : monthsCovered >= 3
          ? 'Boa liquidez. Você tem cobertura para 3+ meses de despesas.'
          : monthsCovered >= 1
          ? `Liquidez moderada. Suas reservas cobrem ${monthsCovered.toFixed(1)} meses de despesas.`
          : 'Liquidez crítica. Suas reservas líquidas cobrem menos de 1 mês de despesas.',
      color: 'hsl(220, 70%, 50%)',
    };

    // =====================
    // PILAR 2 — Controle de Gastos
    // =====================
    const taxaGastos = avgReceita > 0 ? totalGastos / receitaLiquidaTotal : 1;
    const gastosScore = scoreControleGastos(taxaGastos);

    const gastosPillar: PillarScore = {
      name: 'Controle de Gastos',
      score: gastosScore,
      max: 20,
      indicator: 'Taxa de gastos',
      indicatorValue: `${(taxaGastos * 100).toFixed(0)}% da renda`,
      insight:
        taxaGastos < 0.5
          ? 'Parabéns! Seus gastos consomem menos de 50% da renda.'
          : taxaGastos < 0.7
          ? `Bom controle. Seus gastos representam ${(taxaGastos * 100).toFixed(0)}% da renda.`
          : taxaGastos < 0.9
          ? `Atenção: suas despesas estão consumindo ${(taxaGastos * 100).toFixed(0)}% da renda.`
          : `Alerta: suas despesas estão consumindo ${(taxaGastos * 100).toFixed(0)}% da renda, deixando pouca margem.`,
      color: 'hsl(152, 60%, 40%)',
    };

    // =====================
    // PILAR 3 — Endividamento
    // =====================
    const debtToIncome = avgReceita > 0 ? totalMonthlyDebt / avgReceita : 0;
    const debtScore = scoreEndividamento(debtToIncome);

    const debtPillar: PillarScore = {
      name: 'Endividamento',
      score: debtScore,
      max: 20,
      indicator: 'Parcelas / renda mensal',
      indicatorValue: `${(debtToIncome * 100).toFixed(0)}% da renda`,
      insight:
        debtToIncome < 0.1
          ? 'Excelente! Suas dívidas comprometem menos de 10% da renda mensal.'
          : debtToIncome < 0.2
          ? `Nível saudável. ${(debtToIncome * 100).toFixed(0)}% da renda comprometida com dívidas.`
          : debtToIncome < 0.3
          ? `Moderado. ${(debtToIncome * 100).toFixed(0)}% da renda está comprometida com parcelas.`
          : `Atenção: ${(debtToIncome * 100).toFixed(0)}% da renda está comprometida com dívidas.`,
      color: 'hsl(280, 60%, 50%)',
    };

    // =====================
    // PILAR 4 — Reserva de Emergência
    // =====================
    const emergencyMonths = avgDespesas > 0 ? emergencyReserve / avgDespesas : 0;
    const reservaScore = scoreReservaEmergencia(emergencyMonths);

    const reservaPillar: PillarScore = {
      name: 'Reserva de Emergência',
      score: reservaScore,
      max: 20,
      indicator: 'Meses de despesas cobertos',
      indicatorValue: `${emergencyMonths.toFixed(1)} meses`,
      insight:
        avgDespesas === 0
          ? 'Sem histórico de despesas nos últimos 3 meses — lance seus gastos para avaliar este pilar.'
          : emergencyMonths >= 12
          ? 'Reserva de emergência excelente! Você tem mais de 12 meses protegidos.'
          : emergencyMonths >= 6
          ? `Boa reserva. Você tem ${emergencyMonths.toFixed(1)} meses de cobertura.`
          : emergencyMonths >= 3
          ? `Reserva adequada, mas o ideal é ter 6+ meses. Atual: ${emergencyMonths.toFixed(1)} meses.`
          : emergencyMonths >= 1
          ? `Sua reserva de emergência cobre apenas ${emergencyMonths.toFixed(1)} mês(es) de despesas.`
          : 'Você ainda não tem reserva de emergência. Comece com 1 mês de despesas.',
      color: 'hsl(38, 92%, 50%)',
    };

    // =====================
    // PILAR 5 — Capacidade de Poupança
    // =====================
    // Savings = investimentos lançados + o que sobra (receita - gastos - dívidas)
    const avgSalvo = avgInvestimentos + Math.max(0, avgReceita - avgDespesas - totalMonthlyDebt);
    const taxaPoupanca = avgReceita > 0 ? avgSalvo / avgReceita : 0;
    const poupancaScore = scoreCapacidadePoupanca(taxaPoupanca);

    const poupancaPillar: PillarScore = {
      name: 'Capacidade de Poupança',
      score: poupancaScore,
      max: 20,
      indicator: 'Taxa de poupança',
      indicatorValue: `${(taxaPoupanca * 100).toFixed(0)}% da renda`,
      insight:
        taxaPoupanca >= 0.2
          ? 'Excelente! Você está poupando 20%+ da renda.'
          : taxaPoupanca >= 0.1
          ? `Bom ritmo de poupança: ${(taxaPoupanca * 100).toFixed(0)}% da renda.`
          : taxaPoupanca >= 0.05
          ? `Poupança moderada (${(taxaPoupanca * 100).toFixed(0)}%). Tente aumentar para ao menos 10%.`
          : taxaPoupanca > 0
          ? `Poupança baixa (${(taxaPoupanca * 100).toFixed(0)}%). Revise seus gastos para poupar mais.`
          : 'Você não está conseguindo poupar. Analise seus gastos fixos e variáveis.',
      color: 'hsl(0, 72%, 51%)',
    };

    const pillars = [liquidezPillar, gastosPillar, debtPillar, reservaPillar, poupancaPillar];
    const total = pillars.reduce((s, p) => s + p.score, 0);
    const { label, color } = getClassification(total);

    // Recommendations
    const recs: string[] = [];
    if (liquidezScore < 10) recs.push(`Aumente suas reservas líquidas. Atualmente cobrem apenas ${monthsCovered.toFixed(1)} meses de despesas.`);
    if (gastosScore < 10) recs.push(`Suas despesas consomem ${(taxaGastos * 100).toFixed(0)}% da renda. Identifique categorias para reduzir.`);
    if (debtScore < 10) recs.push(`${(debtToIncome * 100).toFixed(0)}% da sua renda está comprometida com dívidas. Considere quitar as de maior juros.`);
    if (reservaScore < 10) recs.push(`Sua reserva de emergência cobre ${emergencyMonths.toFixed(1)} meses. A meta é ter ao menos 6 meses.`);
    if (poupancaScore < 10) recs.push(`Taxa de poupança em ${(taxaPoupanca * 100).toFixed(0)}%. Tente reservar ao menos 10% da renda mensalmente.`);
    if (recs.length === 0) recs.push('Parabéns! Sua saúde financeira está em ótimo nível. Continue com a disciplina atual.');

    return { total, classification: label, classificationColor: color, pillars, recommendations: recs, isLoading: false };
  }, [transactions, categories, assets, liabilities]);

  if (isLoading) {
    return {
      total: 0,
      classification: '',
      classificationColor: '',
      pillars: [],
      recommendations: [],
      isLoading: true,
    };
  }

  return result;
}
