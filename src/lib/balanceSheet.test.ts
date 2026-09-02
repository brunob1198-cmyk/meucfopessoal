import { describe, it, expect } from 'vitest';
import {
  formatMonthLabel, computeNetWorth, computeGrowth12m, isConsecutiveMonths, computeGrowthDrivers,
} from './balanceSheet';

describe('formatMonthLabel', () => {
  it('formata "YYYY-MM-DD" sem deslocar o mês (bug de fuso)', () => {
    expect(formatMonthLabel('2026-08-01')).toBe('ago/26');
    expect(formatMonthLabel('2026-01-01')).toBe('jan/26');
  });

  it('formata "YYYY-MM" (sem dia) igualmente', () => {
    expect(formatMonthLabel('2026-08')).toBe('ago/26');
  });

  it('lida corretamente com virada de ano', () => {
    expect(formatMonthLabel('2025-12-01')).toBe('dez/25');
    expect(formatMonthLabel('2026-01-01')).toBe('jan/26');
  });

  it('retorna o texto original se não reconhecer o formato', () => {
    expect(formatMonthLabel('não-é-uma-data')).toBe('não-é-uma-data');
  });
});

describe('computeNetWorth', () => {
  it('soma ativos - passivos + lucro acumulado', () => {
    expect(computeNetWorth(10_000, 3_000, 500)).toBe(7_500);
    expect(computeNetWorth(1_000, 1_500, 800)).toBe(300);
  });
});

describe('computeGrowth12m', () => {
  it('retorna null com menos de 2 registros', () => {
    expect(computeGrowth12m([])).toBeNull();
    expect(computeGrowth12m([{ month: '2026-08-01', net_worth: 100 }])).toBeNull();
  });

  it('compara com o registro de 12 meses atrás quando existe', () => {
    const history = [
      { month: '2025-08-01', net_worth: 1000 },
      { month: '2026-01-01', net_worth: 1200 },
      { month: '2026-08-01', net_worth: 1500 },
    ];
    const result = computeGrowth12m(history);
    expect(result?.delta).toBe(500); // 1500 - 1000
    expect(result?.months).toBe(12);
  });

  it('usa o registro mais antigo como fallback quando não há um de 12 meses atrás, e informa o período real', () => {
    const history = [
      { month: '2026-06-01', net_worth: 900 },
      { month: '2026-08-01', net_worth: 1500 },
    ];
    const result = computeGrowth12m(history);
    expect(result?.delta).toBe(600); // 1500 - 900
    expect(result?.months).toBe(2); // não são 12 meses de verdade — bug corrigido
  });
});

describe('isConsecutiveMonths', () => {
  it('true para meses em sequência, incluindo virada de ano', () => {
    expect(isConsecutiveMonths(['2025-11-01', '2025-12-01', '2026-01-01'])).toBe(true);
  });

  it('false quando há um mês faltando (gap)', () => {
    expect(isConsecutiveMonths(['2026-06-01', '2026-08-01'])).toBe(false);
  });

  it('true para lista vazia ou de um único mês', () => {
    expect(isConsecutiveMonths([])).toBe(true);
    expect(isConsecutiveMonths(['2026-08-01'])).toBe(true);
  });
});

describe('computeGrowthDrivers', () => {
  it('os 3 valores somam exatamente o crescimento total quando a poupança é positiva', () => {
    const { poupanca, investmentReturns, assetAppreciation } = computeGrowthDrivers(5000, 2000);
    expect(poupanca).toBe(2000);
    expect(poupanca + investmentReturns + assetAppreciation).toBeCloseTo(5000, 6);
  });

  it('poupança negativa não infla os outros motores (bug corrigido)', () => {
    const { poupanca, investmentReturns, assetAppreciation } = computeGrowthDrivers(5000, -1000);
    expect(poupanca).toBe(0);
    expect(poupanca + investmentReturns + assetAppreciation).toBeCloseTo(5000, 6);
  });

  it('crescimento total zero resulta em todos os motores zerados (poupança não positiva)', () => {
    const { poupanca, investmentReturns, assetAppreciation } = computeGrowthDrivers(0, 0);
    expect(poupanca).toBe(0);
    expect(investmentReturns).toBe(0);
    expect(assetAppreciation).toBe(0);
  });

  it('poupança maior que o crescimento total é limitada ao crescimento total (bug corrigido)', () => {
    const { poupanca, investmentReturns, assetAppreciation } = computeGrowthDrivers(1000, 5000);
    expect(poupanca).toBe(1000); // não 5000
    expect(investmentReturns).toBe(0);
    expect(assetAppreciation).toBe(0);
    expect(poupanca + investmentReturns + assetAppreciation).toBe(1000);
  });
});
