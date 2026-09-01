import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Extrai ano/mês do texto "YYYY-MM..." (formato salvo no banco) em vez de usar
// `new Date(string)`, que interpreta a data como meia-noite UTC e pode "voltar"
// um dia (e um mês, perto de virada de mês) em fusos negativos como o do Brasil.
function parseYearMonth(monthKey: string): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})/.exec(monthKey);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1 };
}

export function formatMonthLabel(monthKey: string, formatStr: string = 'MMM/yy'): string {
  const ym = parseYearMonth(monthKey);
  if (!ym) return monthKey;
  return format(new Date(ym.year, ym.month, 1), formatStr, { locale: ptBR });
}

export function computeNetWorth(totalAssets: number, totalLiabilities: number, accumulatedProfit: number): number {
  return totalAssets - totalLiabilities + accumulatedProfit;
}

export interface NetWorthSnapshotLike {
  month: string;
  net_worth: number | string;
}

export function computeGrowth12m(history: NetWorthSnapshotLike[]): number | null {
  if (history.length < 2) return null;
  const sorted = [...history].sort((a, b) => a.month.localeCompare(b.month));
  const latest = sorted[sorted.length - 1];
  const latestYm = parseYearMonth(latest.month);
  const yearAgo =
    (latestYm &&
      sorted.find((s) => {
        const ym = parseYearMonth(s.month);
        return ym !== null && latestYm.year - ym.year === 1 && latestYm.month === ym.month;
      })) ||
    sorted[0];
  return Number(latest.net_worth) - Number(yearAgo.net_worth);
}

// Confirma que os meses (já em ordem cronológica) são consecutivos, sem gaps —
// usado pelo alerta de "queda por 3 meses seguidos", que antes só olhava a
// posição no array, sem checar se de fato eram 3 meses em sequência.
export function isConsecutiveMonths(monthKeys: string[]): boolean {
  for (let i = 1; i < monthKeys.length; i++) {
    const prev = parseYearMonth(monthKeys[i - 1]);
    const curr = parseYearMonth(monthKeys[i]);
    if (!prev || !curr) return false;
    const diffMonths = (curr.year - prev.year) * 12 + (curr.month - prev.month);
    if (diffMonths !== 1) return false;
  }
  return true;
}

export interface GrowthDrivers {
  poupanca: number;
  investmentReturns: number;
  assetAppreciation: number;
}

// O clamp de `annualSavings` é aplicado uma única vez, antes de qualquer
// subtração, para os 3 valores sempre somarem exatamente `totalGrowth` (quando
// ≥ 0) — antes, poupança negativa era zerada só na exibição, mas continuava
// entrando (como valor negativo subtraído) nas contas de investimento/valorização,
// inflando os dois acima do crescimento real.
// Caso residual (não corrigido aqui): se a poupança sozinha for maior que o
// crescimento total (ex.: parte do patrimônio se desvalorizou no período), a
// soma dos 3 valores pode superar `totalGrowth` — não há uma 4ª categoria de
// "perdas" para absorver essa diferença.
export function computeGrowthDrivers(totalGrowth: number, annualSavings: number): GrowthDrivers {
  const poupanca = Math.max(0, annualSavings);
  const investmentReturns = Math.max(0, totalGrowth - poupanca) * 0.7;
  const assetAppreciation = Math.max(0, totalGrowth - poupanca - investmentReturns);
  return { poupanca, investmentReturns, assetAppreciation };
}
