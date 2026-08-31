import { Flame, Lightbulb, PiggyBank, TrendingUp, Zap, Award, type LucideIcon } from 'lucide-react';

export interface Scenario {
  id: string;
  name: string;
  color: string;
  currentAge: number;
  targetAge: number;
  returnRate: number;
  currentInvestment: number;
  monthlyInvestment: number;
  incomeGrowth: number;
  expenseGrowth: number;
}

export type FinancialEventType = 'imovel' | 'veiculo' | 'aumento_despesas' | 'aumento_renda';

export interface FinancialEvent {
  id: string;
  type: FinancialEventType;
  label: string;
  amount: number;
  yearFromNow: number;
  monthlyImpact: number;
}

export interface ProjectionPoint {
  year: number;
  patrimonio: number;
  renda: number;
  despesas: number;
  investido: number;
  rendaPassiva: number;
  taxaCobertura: number;
}

export function computeProjection(
  scenario: Scenario,
  monthlyIncome: number,
  monthlyExpenses: number,
  events: FinancialEvent[],
  extraPassiveIncome: number = 0,
  years: number = 30
): ProjectionPoint[] {
  const data: ProjectionPoint[] = [];
  let patrimonio = scenario.currentInvestment;
  let renda = monthlyIncome;
  let despesas = monthlyExpenses;
  let totalInvestido = scenario.currentInvestment;
  // Renda passiva real (aluguéis, dividendos etc.) somada à renda gerada pelo
  // patrimônio simulado, para o ano 0 desta projeção bater com a Taxa de Cobertura
  // "atual" exibida na tela — cresce junto com a renda ativa (incomeGrowth).
  let passiveIncomeExtra = extraPassiveIncome;

  for (let y = 0; y <= years; y++) {
    const yearEvents = events.filter((e) => e.yearFromNow === y);
    for (const ev of yearEvents) {
      if (ev.type === 'imovel' || ev.type === 'veiculo') {
        patrimonio -= ev.amount;
        despesas += ev.monthlyImpact;
      } else if (ev.type === 'aumento_despesas') {
        despesas += ev.monthlyImpact;
      } else if (ev.type === 'aumento_renda') {
        renda += ev.monthlyImpact;
      }
    }

    const rendaPassivaMensal = (patrimonio * (scenario.returnRate / 100)) / 12 + passiveIncomeExtra;
    const taxaCobertura = despesas > 0 ? (rendaPassivaMensal / despesas) * 100 : 0;

    data.push({
      year: new Date().getFullYear() + y,
      patrimonio: Math.round(patrimonio),
      renda: Math.round(renda * 12),
      despesas: Math.round(despesas * 12),
      investido: Math.round(totalInvestido),
      rendaPassiva: Math.round(rendaPassivaMensal),
      taxaCobertura: Math.round(taxaCobertura * 10) / 10,
    });

    if (y < years) {
      const monthlyRate = scenario.returnRate / 100 / 12;
      for (let m = 0; m < 12; m++) {
        patrimonio = patrimonio * (1 + monthlyRate) + scenario.monthlyInvestment;
        totalInvestido += scenario.monthlyInvestment;
      }
      renda *= 1 + scenario.incomeGrowth / 100;
      despesas *= 1 + scenario.expenseGrowth / 100;
      passiveIncomeExtra *= 1 + scenario.incomeGrowth / 100;
    }
  }

  return data;
}

export interface CoverageLevel {
  min: number;
  max: number;
  label: string;
  emoji: string;
  color: string;
  icon: LucideIcon;
  description: string;
}

// Fonte única dos níveis de cobertura — usada tanto pelo card "Taxa de Cobertura"
// quanto pela lista "Níveis de Liberdade", para nunca divergirem entre si.
export const COVERAGE_LEVELS: CoverageLevel[] = [
  { min: 0, max: 10, label: 'Início da Jornada', emoji: '🌱', color: 'text-muted-foreground', icon: Flame, description: 'Cada real investido te aproxima da liberdade financeira.' },
  { min: 10, max: 25, label: 'Primeiros Frutos', emoji: '🌿', color: 'text-amber-600', icon: Lightbulb, description: 'Você já colhe os primeiros resultados dos investimentos.' },
  { min: 25, max: 50, label: 'Semi-independência', emoji: '🌳', color: 'text-amber-500', icon: PiggyBank, description: 'Seus investimentos já geram renda relevante.' },
  { min: 50, max: 75, label: 'Liberdade Significativa', emoji: '⭐', color: 'text-primary', icon: TrendingUp, description: 'Metade da sua vida já é financiada pelos investimentos.' },
  { min: 75, max: 100, label: 'Quase Independente', emoji: '🚀', color: 'text-emerald-500', icon: Zap, description: 'Falta pouco para a independência total.' },
  { min: 100, max: Infinity, label: 'Independência Financeira', emoji: '🏆', color: 'text-emerald-600', icon: Award, description: 'Seus investimentos cobrem 100% das suas despesas!' },
];

export function getCoverageLevel(pct: number): CoverageLevel {
  for (let i = COVERAGE_LEVELS.length - 1; i >= 0; i--) {
    if (pct >= COVERAGE_LEVELS[i].min) return COVERAGE_LEVELS[i];
  }
  return COVERAGE_LEVELS[0];
}

// Soma o valor dos ativos cujo `category` está entre as categorias informadas
// (ex.: ASSET_GROUPS['Investimentos'] de useBalanceSheet.ts) — recebe a lista de
// categorias por parâmetro para não depender do hook (que importa o cliente Supabase).
export function getInvestedAssetsValue(
  assets: { category: string; current_value: number | string }[],
  investedCategories: readonly string[]
): number {
  return assets
    .filter((a) => investedCategories.includes(a.category))
    .reduce((sum, a) => sum + Number(a.current_value), 0);
}
