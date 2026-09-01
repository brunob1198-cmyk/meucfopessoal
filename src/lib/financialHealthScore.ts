export interface CategoryLike {
  id: string;
  name: string;
  dre_type: string;
  parent_id: string | null;
}

export interface TransactionLike {
  amount: number;
  category_id: string;
}

// Réplica da heurística já usada em src/lib/dre.ts para separar receitas e
// despesas financeiras dentro do tipo 'resultado_financeiro': dos pares de
// categorias-pai desse tipo, a que tem "despesa" no nome é a financeira negativa
// (ex.: juros pagos) — é essa parcela que representa saída de caixa real.
export function getDespesasFinanceiras(
  transactions: TransactionLike[],
  categories: CategoryLike[]
): number {
  const parentCategories = categories.filter((c) => !c.parent_id);
  const rfDespesaParents = parentCategories.filter(
    (c) => c.dre_type === 'resultado_financeiro' && c.name.toLowerCase().includes('despesa')
  );
  const sumByParentId = (parentId: string) =>
    transactions
      .filter((t) => categories.find((c) => c.id === t.category_id)?.parent_id === parentId)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);

  return rfDespesaParents.reduce((sum, p) => sum + sumByParentId(p.id), 0);
}

export interface PillarScore {
  name: string;
  score: number;
  max: number;
  indicator: string;
  indicatorValue: string;
  insight: string;
  color: string;
}

export interface ScoreClassification {
  min: number;
  max: number;
  label: string;
  color: string;
  toneClass: string;
}

// Fonte única dos limiares de classificação — usada pelo hook (badge), pelo círculo
// de progresso da página e pelo card do Dashboard, para nunca divergirem entre si.
export const SCORE_CLASSIFICATIONS: ScoreClassification[] = [
  { min: 0, max: 40, label: 'Saúde financeira crítica', color: 'hsl(0, 72%, 51%)', toneClass: 'text-destructive' },
  { min: 40, max: 60, label: 'Saúde financeira frágil', color: 'hsl(25, 90%, 52%)', toneClass: 'text-warning' },
  { min: 60, max: 75, label: 'Saúde financeira moderada', color: 'hsl(38, 92%, 50%)', toneClass: 'text-warning' },
  { min: 75, max: 90, label: 'Boa saúde financeira', color: 'hsl(152, 50%, 48%)', toneClass: 'text-primary' },
  { min: 90, max: Infinity, label: 'Excelente saúde financeira', color: 'hsl(152, 60%, 40%)', toneClass: 'text-primary' },
];

export function getClassification(score: number): ScoreClassification {
  for (let i = SCORE_CLASSIFICATIONS.length - 1; i >= 0; i--) {
    if (score >= SCORE_CLASSIFICATIONS[i].min) return SCORE_CLASSIFICATIONS[i];
  }
  return SCORE_CLASSIFICATIONS[0];
}

// As 5 funções de pontuação por pilar — puras, cada uma reflete os mesmos limiares
// hoje usados no hook, para serem testáveis isoladamente e reaproveitadas pela
// calculadora de demonstração da landing page.

export function scoreLiquidez(monthsCovered: number): number {
  if (monthsCovered >= 6) return 20;
  if (monthsCovered >= 3) return 15;
  if (monthsCovered >= 2) return 10;
  if (monthsCovered >= 1) return 5;
  return 0;
}

export function scoreControleGastos(taxaGastos: number): number {
  if (taxaGastos < 0.5) return 20;
  if (taxaGastos < 0.7) return 15;
  if (taxaGastos < 0.9) return 10;
  if (taxaGastos < 1.0) return 5;
  return 0;
}

export function scoreEndividamento(debtToIncome: number): number {
  if (debtToIncome < 0.1) return 20;
  if (debtToIncome < 0.2) return 15;
  if (debtToIncome < 0.3) return 10;
  if (debtToIncome < 0.5) return 5;
  return 0;
}

export function scoreReservaEmergencia(months: number): number {
  if (months >= 12) return 20;
  if (months >= 6) return 15;
  if (months >= 3) return 10;
  if (months >= 1) return 5;
  return 0;
}

export function scoreCapacidadePoupanca(taxaPoupanca: number): number {
  if (taxaPoupanca >= 0.2) return 20;
  if (taxaPoupanca >= 0.1) return 15;
  if (taxaPoupanca >= 0.05) return 10;
  if (taxaPoupanca > 0) return 5;
  return 0;
}
