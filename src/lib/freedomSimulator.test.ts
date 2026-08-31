import { describe, it, expect } from 'vitest';
import {
  computeProjection, getCoverageLevel, COVERAGE_LEVELS, getInvestedAssetsValue, computeMonthsOfHistory,
  type Scenario, type FinancialEvent,
} from './freedomSimulator';

function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: '1',
    name: 'Cenário Atual',
    color: '#000',
    currentAge: 30,
    targetAge: 55,
    returnRate: 12, // 1% ao mês, facilita conferir a mão
    currentInvestment: 10_000,
    monthlyInvestment: 1_000,
    incomeGrowth: 0,
    expenseGrowth: 0,
    ...overrides,
  };
}

describe('computeProjection', () => {
  it('mantém o patrimônio inicial e a taxa de cobertura no ano 0', () => {
    const scenario = makeScenario();
    const data = computeProjection(scenario, 5_000, 2_000, []);
    expect(data[0].patrimonio).toBe(10_000);
    // rendaPassivaMensal = 10_000 * 0.12 / 12 = 100; taxaCobertura = 100/2000*100 = 5%
    expect(data[0].rendaPassiva).toBe(100);
    expect(data[0].taxaCobertura).toBe(5);
  });

  it('compõe o patrimônio mensalmente com aporte fixo', () => {
    const scenario = makeScenario({ currentInvestment: 0, monthlyInvestment: 1_000, returnRate: 12 });
    const data = computeProjection(scenario, 0, 1, []);
    // 12 meses de aporte de 1000 a 1%/mês compostos
    let expected = 0;
    for (let m = 0; m < 12; m++) expected = expected * 1.01 + 1000;
    expect(data[1].patrimonio).toBe(Math.round(expected));
  });

  it('cresce renda e despesa de acordo com incomeGrowth/expenseGrowth', () => {
    const scenario = makeScenario({ incomeGrowth: 10, expenseGrowth: 5 });
    const data = computeProjection(scenario, 1_000, 500, []);
    expect(data[1].renda).toBe(Math.round(1_000 * 1.1 * 12));
    expect(data[1].despesas).toBe(Math.round(500 * 1.05 * 12));
  });

  it('imóvel/veículo financiado: só soma despesa recorrente, sem descontar patrimônio', () => {
    const scenario = makeScenario({ currentInvestment: 100_000, monthlyInvestment: 0, returnRate: 0 });
    const events: FinancialEvent[] = [
      { id: 'e1', type: 'imovel', label: 'Compra de Imóvel', amount: 50_000, yearFromNow: 2, monthlyImpact: 300, paymentMode: 'financiado' },
    ];
    const data = computeProjection(scenario, 5_000, 2_000, events);
    expect(data[1].patrimonio).toBe(100_000);
    expect(data[2].patrimonio).toBe(100_000); // financiado não mexe no patrimônio
    expect(data[2].despesas).toBe(Math.round((2_000 + 300) * 12)); // só a parcela mensal entra
  });

  it('imóvel/veículo à vista: só desconta patrimônio uma vez, sem despesa recorrente', () => {
    const scenario = makeScenario({ currentInvestment: 100_000, monthlyInvestment: 0, returnRate: 0 });
    const events: FinancialEvent[] = [
      { id: 'e1', type: 'imovel', label: 'Compra de Imóvel', amount: 50_000, yearFromNow: 2, monthlyImpact: 300, paymentMode: 'a_vista' },
    ];
    const data = computeProjection(scenario, 5_000, 2_000, events);
    expect(data[1].patrimonio).toBe(100_000); // ano 1: evento ainda não ocorreu
    expect(data[2].patrimonio).toBe(50_000); // desconto integral do valor à vista
    expect(data[2].despesas).toBe(Math.round(2_000 * 12)); // sem parcela recorrente
  });

  it('evento de imóvel/veículo sem paymentMode (dado legado) se comporta como financiado', () => {
    const scenario = makeScenario({ currentInvestment: 100_000, monthlyInvestment: 0, returnRate: 0 });
    const events: FinancialEvent[] = [
      { id: 'e1', type: 'veiculo', label: 'Compra de Veículo', amount: 50_000, yearFromNow: 1, monthlyImpact: 300 },
    ];
    const data = computeProjection(scenario, 5_000, 2_000, events);
    expect(data[1].patrimonio).toBe(100_000); // sem desconto de patrimônio
    expect(data[1].despesas).toBe(Math.round((2_000 + 300) * 12)); // com parcela recorrente
  });

  it('aumento_despesas soma monthlyImpact à despesa, sem usar amount', () => {
    const scenario = makeScenario();
    const events: FinancialEvent[] = [
      { id: 'e2', type: 'aumento_despesas', label: 'Aumento de Despesas', amount: 999_999, yearFromNow: 1, monthlyImpact: 200 },
    ];
    const data = computeProjection(scenario, 5_000, 2_000, events);
    expect(data[1].despesas).toBe(Math.round((2_000 + 200) * 12));
  });

  it('aumento_renda soma monthlyImpact à renda, sem usar amount', () => {
    const scenario = makeScenario();
    const events: FinancialEvent[] = [
      { id: 'e3', type: 'aumento_renda', label: 'Aumento de Renda', amount: 999_999, yearFromNow: 1, monthlyImpact: 300 },
    ];
    const data = computeProjection(scenario, 5_000, 2_000, events);
    expect(data[1].renda).toBe(Math.round((5_000 + 300) * 12));
  });

  it('taxaCobertura é 0 quando despesas são 0 (evita divisão por zero)', () => {
    const scenario = makeScenario();
    const data = computeProjection(scenario, 1_000, 0, []);
    expect(data[0].taxaCobertura).toBe(0);
  });

  it('extraPassiveIncome soma à renda passiva do ano 0 e cresce com incomeGrowth', () => {
    const scenario = makeScenario({ currentInvestment: 0, monthlyInvestment: 0, returnRate: 0, incomeGrowth: 10 });
    const data = computeProjection(scenario, 1_000, 500, [], 200);
    // patrimônio 0 e retorno 0% => rendaPassivaMensal vem só do extraPassiveIncome
    expect(data[0].rendaPassiva).toBe(200);
    expect(data[0].taxaCobertura).toBe(40); // 200/500*100
    expect(data[1].rendaPassiva).toBe(Math.round(200 * 1.1));
  });
});

describe('getCoverageLevel / COVERAGE_LEVELS', () => {
  it('cobre os valores de fronteira sem lacunas nem sobreposições', () => {
    expect(getCoverageLevel(0).label).toBe('Início da Jornada');
    expect(getCoverageLevel(9.9).label).toBe('Início da Jornada');
    expect(getCoverageLevel(10).label).toBe('Primeiros Frutos');
    expect(getCoverageLevel(24.9).label).toBe('Primeiros Frutos');
    expect(getCoverageLevel(25).label).toBe('Semi-independência');
    expect(getCoverageLevel(49.9).label).toBe('Semi-independência');
    expect(getCoverageLevel(50).label).toBe('Liberdade Significativa');
    expect(getCoverageLevel(74.9).label).toBe('Liberdade Significativa');
    expect(getCoverageLevel(75).label).toBe('Quase Independente');
    expect(getCoverageLevel(99.9).label).toBe('Quase Independente');
    expect(getCoverageLevel(100).label).toBe('Independência Financeira');
    expect(getCoverageLevel(150).label).toBe('Independência Financeira');
  });

  it('COVERAGE_LEVELS está ordenado e contíguo (max de um nível == min do próximo)', () => {
    for (let i = 0; i < COVERAGE_LEVELS.length - 1; i++) {
      expect(COVERAGE_LEVELS[i].max).toBe(COVERAGE_LEVELS[i + 1].min);
    }
  });
});

describe('getInvestedAssetsValue', () => {
  const investedCategories = ['renda_fixa', 'acoes', 'fundos', 'criptomoedas'];

  it('soma apenas os ativos das categorias informadas', () => {
    const assets = [
      { category: 'renda_fixa', current_value: 1_000 },
      { category: 'acoes', current_value: 2_000 },
      { category: 'imoveis', current_value: 500_000 },
      { category: 'veiculos', current_value: 80_000 },
    ];
    expect(getInvestedAssetsValue(assets, investedCategories)).toBe(3_000);
  });

  it('retorna 0 quando não há ativos investidos', () => {
    const assets = [{ category: 'imoveis', current_value: 500_000 }];
    expect(getInvestedAssetsValue(assets, investedCategories)).toBe(0);
  });

  it('aceita current_value como string (formato vindo do banco)', () => {
    const assets = [{ category: 'fundos', current_value: '1500.50' }];
    expect(getInvestedAssetsValue(assets, investedCategories)).toBe(1500.5);
  });
});

describe('computeMonthsOfHistory', () => {
  const now = new Date('2026-08-31T12:00:00Z');

  it('retorna 1 quando não há transações', () => {
    expect(computeMonthsOfHistory(null, now)).toBe(1);
  });

  it('conta os meses desde a primeira transação, incluindo o mês atual', () => {
    expect(computeMonthsOfHistory('2026-06-15', now)).toBe(3); // jun, jul, ago
    expect(computeMonthsOfHistory('2026-08-01', now)).toBe(1); // só ago
  });

  it('limita a 12 meses mesmo para contas mais antigas', () => {
    expect(computeMonthsOfHistory('2020-01-01', now)).toBe(12);
  });

  it('nunca retorna menos que 1', () => {
    expect(computeMonthsOfHistory('2026-08-31', now)).toBe(1);
  });
});
