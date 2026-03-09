import { useMemo } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useAssets, useLiabilities } from '@/hooks/useBalanceSheet';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export interface PillarScore {
  name: string;
  score: number;
  max: number;
  indicator: string;
  indicatorValue: string;
  insight: string;
  color: string;
}

export interface FinancialHealthScore {
  total: number;
  classification: string;
  classificationColor: string;
  pillars: PillarScore[];
  recommendations: string[];
  isLoading: boolean;
}

function clamp(v: number, min = 0, max = 20) {
  return Math.min(max, Math.max(min, v));
}

function getClassification(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Excelente saúde financeira', color: 'hsl(152, 60%, 40%)' };
  if (score >= 75) return { label: 'Boa saúde financeira', color: 'hsl(152, 50%, 48%)' };
  if (score >= 60) return { label: 'Saúde financeira moderada', color: 'hsl(38, 92%, 50%)' };
  if (score >= 40) return { label: 'Saúde financeira frágil', color: 'hsl(25, 90%, 52%)' };
  return { label: 'Saúde financeira crítica', color: 'hsl(0, 72%, 51%)' };
}

export function useFinancialHealthScore(): FinancialHealthScore {
  // Use last 3 months for average calculations
  const now = new Date();
  const threeMonthsAgo = subMonths(startOfMonth(now), 2);
  const startDate = format(threeMonthsAgo, 'yyyy-MM-dd');
  const endDate = format(endOfMonth(now), 'yyyy-MM-dd');

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
    const totalInvestimentos = sumByDreType('investimento');

    const receitaLiquidaTotal = totalReceita - totalDescontos;
    const totalGastos = totalDespesas + totalCustos;

    const avgReceita = receitaLiquidaTotal / months;
    const avgDespesas = totalGastos / months;
    const avgInvestimentos = totalInvestimentos / months;

    // --- Balance Sheet ---
    const assetsArr = assets as any[];
    const liabArr = liabilities as any[];

    // Liquid assets: conta_corrente, poupanca, dinheiro_caixa
    const liquidCategories = ['conta_corrente', 'poupanca', 'dinheiro_caixa'];
    const emergencyCategories = ['conta_corrente', 'poupanca', 'dinheiro_caixa', 'renda_fixa', 'fundos'];

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
    let liquidezScore = 0;
    const monthsCovered = avgDespesas > 0 ? liquidAssets / avgDespesas : 0;
    if (monthsCovered >= 6) liquidezScore = 20;
    else if (monthsCovered >= 3) liquidezScore = 15;
    else if (monthsCovered >= 2) liquidezScore = 10;
    else if (monthsCovered >= 1) liquidezScore = 5;

    const liquidezPillar: PillarScore = {
      name: 'Liquidez',
      score: liquidezScore,
      max: 20,
      indicator: 'Meses de despesas cobertos',
      indicatorValue: `${monthsCovered.toFixed(1)} meses`,
      insight:
        monthsCovered >= 6
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
    let gastosScore = 0;
    const taxaGastos = avgReceita > 0 ? totalGastos / receitaLiquidaTotal : 1;
    if (taxaGastos < 0.5) gastosScore = 20;
    else if (taxaGastos < 0.7) gastosScore = 15;
    else if (taxaGastos < 0.9) gastosScore = 10;
    else if (taxaGastos < 1.0) gastosScore = 5;

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
    let debtScore = 0;
    const debtToIncome = avgReceita > 0 ? totalMonthlyDebt / avgReceita : 0;
    if (debtToIncome < 0.1) debtScore = 20;
    else if (debtToIncome < 0.2) debtScore = 15;
    else if (debtToIncome < 0.3) debtScore = 10;
    else if (debtToIncome < 0.5) debtScore = 5;

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
    let reservaScore = 0;
    const emergencyMonths = avgDespesas > 0 ? emergencyReserve / avgDespesas : 0;
    if (emergencyMonths >= 12) reservaScore = 20;
    else if (emergencyMonths >= 6) reservaScore = 15;
    else if (emergencyMonths >= 3) reservaScore = 10;
    else if (emergencyMonths >= 1) reservaScore = 5;

    const reservaPillar: PillarScore = {
      name: 'Reserva de Emergência',
      score: reservaScore,
      max: 20,
      indicator: 'Meses de despesas cobertos',
      indicatorValue: `${emergencyMonths.toFixed(1)} meses`,
      insight:
        emergencyMonths >= 12
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
    let poupancaScore = 0;
    // Savings = investimentos lançados + o que sobra (receita - gastos - dívidas)
    const avgSalvo = avgInvestimentos + Math.max(0, avgReceita - avgDespesas - totalMonthlyDebt);
    const taxaPoupanca = avgReceita > 0 ? avgSalvo / avgReceita : 0;
    if (taxaPoupanca >= 0.2) poupancaScore = 20;
    else if (taxaPoupanca >= 0.1) poupancaScore = 15;
    else if (taxaPoupanca >= 0.05) poupancaScore = 10;
    else if (taxaPoupanca > 0) poupancaScore = 5;

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
