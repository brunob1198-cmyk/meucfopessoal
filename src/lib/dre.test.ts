import { describe, it, expect } from 'vitest';
import {
  computeNetProfit, isDespesaFinanceira, classifyCashFlowBucket, computeCashFlowTotals,
  computeDRELucroLiquido, computeDRE,
} from './dre';

function tx(amount: number, dre_type: string, category_id = 'c1') {
  return { amount, category_id, categories: { name: '', dre_type, parent_id: null } };
}

describe('computeNetProfit', () => {
  it('calcula lucro líquido básico (receita - despesa)', () => {
    const result = computeNetProfit([tx(1000, 'receita'), tx(400, 'despesa')]);
    expect(result.receitaBruta).toBe(1000);
    expect(result.despesas).toBe(400);
    expect(result.lucroLiquido).toBe(600);
  });

  it('desconta impostos e descontos do lucro líquido', () => {
    const result = computeNetProfit([tx(1000, 'receita'), tx(100, 'desconto'), tx(50, 'impostos')]);
    // receitaLiquida = 900, sem despesas/custos, lair = 900, lucroLiquido = 900 - 50
    expect(result.lucroLiquido).toBe(850);
  });

  it('retorna zeros para lista vazia', () => {
    const result = computeNetProfit([]);
    expect(result).toEqual({ receitaBruta: 0, despesas: 0, lucroLiquido: 0 });
  });
});

describe('isDespesaFinanceira', () => {
  const categories = [
    { id: 'rf-receita', name: 'Receitas Financeiras', dre_type: 'resultado_financeiro', parent_id: null, sort_order: 0, is_default: false },
    { id: 'rf-despesa', name: 'Despesas Financeiras', dre_type: 'resultado_financeiro', parent_id: null, sort_order: 0, is_default: false },
    { id: 'juros-pagos', name: 'Juros de Empréstimo', dre_type: 'resultado_financeiro', parent_id: 'rf-despesa', sort_order: 0, is_default: false },
    { id: 'juros-recebidos', name: 'Juros de Aplicação', dre_type: 'resultado_financeiro', parent_id: 'rf-receita', sort_order: 0, is_default: false },
    { id: 'aluguel', name: 'Aluguel', dre_type: 'despesa', parent_id: null, sort_order: 0, is_default: false },
  ];

  it('true para categoria (ou subcategoria) sob o pai de despesas financeiras', () => {
    expect(isDespesaFinanceira('juros-pagos', categories)).toBe(true);
    expect(isDespesaFinanceira('rf-despesa', categories)).toBe(true);
  });

  it('false para receita financeira e para outros tipos', () => {
    expect(isDespesaFinanceira('juros-recebidos', categories)).toBe(false);
    expect(isDespesaFinanceira('rf-receita', categories)).toBe(false);
    expect(isDespesaFinanceira('aluguel', categories)).toBe(false);
  });

  it('false para categoria inexistente', () => {
    expect(isDespesaFinanceira('nao-existe', categories)).toBe(false);
  });
});

describe('classifyCashFlowBucket', () => {
  const categories = [
    { id: 'rf-despesa', name: 'Despesas Financeiras', dre_type: 'resultado_financeiro', parent_id: null, sort_order: 0, is_default: false },
    { id: 'juros-pagos', name: 'Juros', dre_type: 'resultado_financeiro', parent_id: 'rf-despesa', sort_order: 0, is_default: false },
    { id: 'rf-receita', name: 'Receitas Financeiras', dre_type: 'resultado_financeiro', parent_id: null, sort_order: 0, is_default: false },
    { id: 'juros-recebidos', name: 'Rendimentos', dre_type: 'resultado_financeiro', parent_id: 'rf-receita', sort_order: 0, is_default: false },
  ];

  it('classifica os tipos simples corretamente', () => {
    expect(classifyCashFlowBucket('receita', 'x', categories)).toBe('entrada');
    expect(classifyCashFlowBucket('outras_receitas', 'x', categories)).toBe('entrada');
    expect(classifyCashFlowBucket('despesa', 'x', categories)).toBe('saida');
    expect(classifyCashFlowBucket('custo', 'x', categories)).toBe('saida');
    expect(classifyCashFlowBucket('impostos', 'x', categories)).toBe('saida');
    expect(classifyCashFlowBucket('investimento', 'x', categories)).toBe('saida');
    expect(classifyCashFlowBucket('depreciacao', 'x', categories)).toBe('neutro');
    expect(classifyCashFlowBucket('desconto', 'x', categories)).toBe('desconto');
  });

  it('resultado_financeiro depende da categoria-pai', () => {
    expect(classifyCashFlowBucket('resultado_financeiro', 'juros-pagos', categories)).toBe('saida');
    expect(classifyCashFlowBucket('resultado_financeiro', 'juros-recebidos', categories)).toBe('entrada');
  });
});

describe('computeCashFlowTotals', () => {
  const categories: { id: string; name: string; dre_type: string; parent_id: string | null; sort_order: number; is_default: boolean }[] = [];

  it('soma entradas e saídas separadamente', () => {
    const totals = computeCashFlowTotals([tx(1000, 'receita'), tx(400, 'despesa'), tx(100, 'custo')], categories);
    expect(totals.entradas).toBe(1000);
    expect(totals.saidas).toBe(500);
  });

  it('estorno negativo reduz o total em vez de somar (bug corrigido)', () => {
    const totals = computeCashFlowTotals([tx(400, 'despesa'), tx(-100, 'despesa')], categories);
    expect(totals.saidas).toBe(300); // não 500, como daria com Math.abs
  });

  it('desconto reduz entradas, não soma em saídas', () => {
    const totals = computeCashFlowTotals([tx(1000, 'receita'), tx(50, 'desconto')], categories);
    expect(totals.entradas).toBe(950);
    expect(totals.saidas).toBe(0);
  });

  it('depreciação não conta em nenhum dos dois totais', () => {
    const totals = computeCashFlowTotals([tx(1000, 'receita'), tx(200, 'depreciacao')], categories);
    expect(totals.entradas).toBe(1000);
    expect(totals.saidas).toBe(0);
  });
});

describe('computeDRELucroLiquido', () => {
  const categories = [
    { id: 'receita-1', name: 'Vendas', dre_type: 'receita', parent_id: null, sort_order: 0, is_default: false },
    { id: 'despesa-1', name: 'Despesas Gerais', dre_type: 'despesa', parent_id: null, sort_order: 0, is_default: false },
    { id: 'invest-1', name: 'Investimentos', dre_type: 'investimento', parent_id: null, sort_order: 0, is_default: false },
    { id: 'rf-despesa', name: 'Despesas Financeiras', dre_type: 'resultado_financeiro', parent_id: null, sort_order: 0, is_default: false },
    { id: 'rf-receita', name: 'Receitas Financeiras', dre_type: 'resultado_financeiro', parent_id: null, sort_order: 0, is_default: false },
    { id: 'juros-pagos', name: 'Juros', dre_type: 'resultado_financeiro', parent_id: 'rf-despesa', sort_order: 0, is_default: false },
    { id: 'juros-recebidos', name: 'Rendimentos', dre_type: 'resultado_financeiro', parent_id: 'rf-receita', sort_order: 0, is_default: false },
  ];

  const transactions = [
    tx(5000, 'receita', 'receita-1'),
    tx(2000, 'despesa', 'despesa-1'),
    tx(500, 'investimento', 'invest-1'),
    tx(100, 'resultado_financeiro', 'juros-pagos'),
    tx(80, 'resultado_financeiro', 'juros-recebidos'),
  ];

  it('bate exatamente com a linha LUCRO LÍQUIDO de computeDRE para o mesmo período', () => {
    const dre = computeDRE(transactions, categories);
    const lucroLine = dre.find((l) => l.label === '(=) LUCRO LÍQUIDO' && l.isTotal);
    expect(computeDRELucroLiquido(transactions, categories)).toBe(lucroLine?.value);
  });

  it('inclui investimento como despesa — diferente de computeNetProfit', () => {
    const txs = [tx(1000, 'receita'), tx(200, 'investimento')];
    expect(computeDRELucroLiquido(txs, [])).toBe(800);
    expect(computeNetProfit(txs).lucroLiquido).toBe(1000); // não desconta investimento
  });
});
