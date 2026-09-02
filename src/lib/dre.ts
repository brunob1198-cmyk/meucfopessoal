import { Category } from '@/hooks/useCategories';

interface Transaction {
  amount: number;
  category_id: string;
  date?: string;
  comment?: string | null;
  categories: { name: string; dre_type: string; parent_id: string | null } | null;
}

export interface DRELine {
  label: string;
  value: number;
  percent: number;
  isTotal: boolean;
  indent: number;
  type?: string;
  categoryId?: string;
  groupId?: string;
  isGroupHeader?: boolean;
  isSubcategory?: boolean;
  parentGroupId?: string;
}

export function computeDRE(
  transactions: Transaction[],
  categories: Category[]
): DRELine[] {
  const sumByType = (type: string) =>
    transactions
      .filter((t) => t.categories?.dre_type === type)
      .reduce((sum, t) => sum + Number(t.amount), 0);

  const sumByParentId = (parentId: string) => {
    return transactions
      .filter((t) => {
        const cat = categories.find((c) => c.id === t.category_id);
        return cat?.parent_id === parentId;
      })
      .reduce((sum, t) => sum + Number(t.amount), 0);
  };

  const detailByParentId = (parentId: string): DRELine[] => {
    const children = categories.filter((c) => c.parent_id === parentId);
    return children.map((child) => {
      const value = transactions
        .filter((t) => t.category_id === child.id)
        .reduce((sum, t) => sum + Number(t.amount), 0);
      return {
        label: child.name,
        value,
        percent: 0,
        isTotal: false,
        indent: 2,
        categoryId: child.id,
        isSubcategory: true,
        parentGroupId: parentId,
      };
    });
    // Include all children (even zero) for consistent row structure across months
  };

  const receitaBruta = sumByType('receita');
  const descontos = sumByType('desconto');
  const receitaLiquida = receitaBruta - descontos;
  const custos = sumByType('custo');
  const lucroBruto = receitaLiquida - custos;
  // 'investimento' entra como despesa aqui (reduz o lucro do período) — diferente
  // do Score de Saúde Financeira (src/hooks/useFinancialHealthScore.ts), que soma
  // o mesmo lançamento como poupança positiva. Divergência intencional: o DRE mede
  // lucro operacional, o Score mede capacidade de poupança pessoal.
  const despesas = sumByType('despesa') + sumByType('investimento');
  const ebitda = lucroBruto - despesas;
  const depreciacao = sumByType('depreciacao');
  const ebit = ebitda - depreciacao;

  const pct = (v: number) => (receitaBruta > 0 ? (v / receitaBruta) * 100 : 0);

  const parentCategories = categories.filter((c) => !c.parent_id);

  // Resultado Financeiro: split into receitas and despesas financeiras
  const rfParents = parentCategories.filter((c) => c.dre_type === 'resultado_financeiro');
  const rfReceitaParents = rfParents.filter((p) => !p.name.toLowerCase().includes('despesa'));
  const rfDespesaParents = rfParents.filter((p) => p.name.toLowerCase().includes('despesa'));

  const receitasFinanceiras = rfReceitaParents.reduce((sum, p) => sum + sumByParentId(p.id), 0);
  const despesasFinanceiras = rfDespesaParents.reduce((sum, p) => sum + sumByParentId(p.id), 0);
  const resultadoFinanceiro = receitasFinanceiras - despesasFinanceiras;

  const outrasReceitas = sumByType('outras_receitas');
  const lair = ebit + resultadoFinanceiro + outrasReceitas;
  const impostos = sumByType('impostos');
  const lucroLiquido = lair - impostos;

  const lines: DRELine[] = [];

  // Receita
  parentCategories
    .filter((p) => p.dre_type === 'receita')
    .forEach((p) => {
      lines.push({
        label: p.name,
        value: sumByParentId(p.id),
        percent: pct(sumByParentId(p.id)),
        isTotal: false,
        indent: 0,
        type: 'receita',
        isGroupHeader: true,
        groupId: p.id,
      });
      detailByParentId(p.id).forEach((d) => lines.push(d));
    });

  lines.push({
    label: '(=) RECEITA BRUTA',
    value: receitaBruta,
    percent: 100,
    isTotal: true,
    indent: 0,
  });

  // Descontos
  parentCategories
    .filter((p) => p.dre_type === 'desconto')
    .forEach((p) => {
      lines.push({
        label: '(-) ' + p.name,
        value: sumByParentId(p.id),
        percent: pct(sumByParentId(p.id)),
        isTotal: false,
        indent: 0,
        type: 'desconto',
        isGroupHeader: true,
        groupId: p.id,
      });
      detailByParentId(p.id).forEach((d) => lines.push(d));
    });

  lines.push({
    label: '(=) RECEITA LÍQUIDA',
    value: receitaLiquida,
    percent: pct(receitaLiquida),
    isTotal: true,
    indent: 0,
  });

  // Custos
  parentCategories
    .filter((p) => p.dre_type === 'custo')
    .forEach((p) => {
      lines.push({
        label: '(-) ' + p.name,
        value: sumByParentId(p.id),
        percent: pct(sumByParentId(p.id)),
        isTotal: false,
        indent: 0,
        type: 'custo',
        isGroupHeader: true,
        groupId: p.id,
      });
      detailByParentId(p.id).forEach((d) => lines.push(d));
    });

  lines.push({
    label: '(=) LUCRO BRUTO',
    value: lucroBruto,
    percent: pct(lucroBruto),
    isTotal: true,
    indent: 0,
  });

  // Despesas
  lines.push({
    label: '(-) DESPESAS',
    value: despesas,
    percent: pct(despesas),
    isTotal: false,
    indent: 0,
    type: 'despesa',
  });
  parentCategories
    .filter((p) => p.dre_type === 'despesa' || p.dre_type === 'investimento')
    .forEach((p) => {
      lines.push({
        label: p.name,
        value: sumByParentId(p.id),
        percent: pct(sumByParentId(p.id)),
        isTotal: false,
        indent: 1,
        isGroupHeader: true,
        groupId: p.id,
      });
      detailByParentId(p.id).forEach((d) => lines.push(d));
    });

  lines.push({ label: '(=) EBITDA', value: ebitda, percent: pct(ebitda), isTotal: true, indent: 0 });
  lines.push({ label: '(-) DEPRECIAÇÃO', value: depreciacao, percent: pct(depreciacao), isTotal: false, indent: 0 });
  lines.push({ label: '(=) EBIT', value: ebit, percent: pct(ebit), isTotal: true, indent: 0 });
  // Resultado Financeiro (receitas - despesas financeiras)
  lines.push({
    label: '(+/-) RESULTADO FINANCEIRO',
    value: resultadoFinanceiro,
    percent: pct(resultadoFinanceiro),
    isTotal: true,
    indent: 0,
    type: 'resultado_financeiro',
  });
  // (+) Receitas Financeiras
  rfReceitaParents.forEach((p) => {
    lines.push({
      label: '(+) ' + p.name,
      value: sumByParentId(p.id),
      percent: pct(sumByParentId(p.id)),
      isTotal: false,
      indent: 1,
      isGroupHeader: true,
      groupId: p.id,
    });
    detailByParentId(p.id).forEach((d) => lines.push(d));
  });
  // (-) Despesas Financeiras
  rfDespesaParents.forEach((p) => {
    lines.push({
      label: '(-) ' + p.name,
      value: sumByParentId(p.id),
      percent: pct(sumByParentId(p.id)),
      isTotal: false,
      indent: 1,
      isGroupHeader: true,
      groupId: p.id,
    });
    detailByParentId(p.id).forEach((d) => lines.push(d));
  });
  lines.push({ label: '(+) OUTRAS RECEITAS', value: outrasReceitas, percent: pct(outrasReceitas), isTotal: false, indent: 0 });
  lines.push({ label: '(=) LAIR', value: lair, percent: pct(lair), isTotal: true, indent: 0 });
  lines.push({ label: '(-) IMPOSTOS', value: impostos, percent: pct(impostos), isTotal: false, indent: 0 });
  lines.push({ label: '(=) LUCRO LÍQUIDO', value: lucroLiquido, percent: pct(lucroLiquido), isTotal: true, indent: 0 });
  lines.push({ label: '% MARGEM LÍQUIDA', value: pct(lucroLiquido), percent: pct(lucroLiquido), isTotal: true, indent: 0, type: 'margem' });


  return lines;
}

export function computeDREAjustado(
  transactions: Transaction[],
  categories: Category[]
): DRELine[] {
  const sumByType = (type: string) =>
    transactions
      .filter((t) => t.categories?.dre_type === type)
      .reduce((sum, t) => sum + Number(t.amount), 0);

  const sumByParentId = (parentId: string) =>
    transactions
      .filter((t) => {
        const cat = categories.find((c) => c.id === t.category_id);
        return cat?.parent_id === parentId;
      })
      .reduce((sum, t) => sum + Number(t.amount), 0);

  const parentCategories = categories.filter((c) => !c.parent_id);

  const receitaBruta = sumByType('receita');
  const descontos = sumByType('desconto');
  const receitaLiquida = receitaBruta - descontos;
  const custos = sumByType('custo');
  const lucroBruto = receitaLiquida - custos;
  const despesas = sumByType('despesa') + sumByType('investimento');
  const ebitda = lucroBruto - despesas;
  const depreciacao = sumByType('depreciacao');
  const ebit = ebitda - depreciacao;

  const rfParents = parentCategories.filter((c) => c.dre_type === 'resultado_financeiro');
  const rfReceitaParents = rfParents.filter((p) => !p.name.toLowerCase().includes('despesa'));
  const rfDespesaParents = rfParents.filter((p) => p.name.toLowerCase().includes('despesa'));
  const receitasFinanceiras = rfReceitaParents.reduce((sum, p) => sum + sumByParentId(p.id), 0);
  const despesasFinanceiras = rfDespesaParents.reduce((sum, p) => sum + sumByParentId(p.id), 0);
  const resultadoFinanceiro = receitasFinanceiras - despesasFinanceiras;

  const outrasReceitas = sumByType('outras_receitas');
  const lair = ebit + resultadoFinanceiro + outrasReceitas;
  const impostos = sumByType('impostos');
  const lucroLiquido = lair - impostos;

  const pct = (v: number) => (receitaBruta > 0 ? (v / receitaBruta) * 100 : 0);

  return [
    { label: 'Receita Bruta', value: receitaBruta, percent: 100, isTotal: false, indent: 0 },
    { label: '(-) Descontos', value: descontos, percent: pct(descontos), isTotal: false, indent: 0 },
    { label: '(=) Receita Líquida', value: receitaLiquida, percent: pct(receitaLiquida), isTotal: true, indent: 0 },
    { label: '(-) Custos', value: custos, percent: pct(custos), isTotal: false, indent: 0 },
    { label: '(=) Lucro Bruto', value: lucroBruto, percent: pct(lucroBruto), isTotal: true, indent: 0 },
    { label: '(-) Despesas Fixas', value: despesas, percent: pct(despesas), isTotal: false, indent: 0 },
    { label: '(=) EBITDA', value: ebitda, percent: pct(ebitda), isTotal: true, indent: 0 },
    { label: '(-) Depreciação', value: depreciacao, percent: pct(depreciacao), isTotal: false, indent: 0 },
    { label: '(=) Lucro Operacional (EBIT)', value: ebit, percent: pct(ebit), isTotal: true, indent: 0 },
    { label: '(+/-) Resultado Financeiro', value: resultadoFinanceiro, percent: pct(resultadoFinanceiro), isTotal: false, indent: 0 },
    { label: '(+) Outras receitas', value: outrasReceitas, percent: pct(outrasReceitas), isTotal: false, indent: 0 },
    { label: '(=) LAIR', value: lair, percent: pct(lair), isTotal: true, indent: 0 },
    { label: '(-) IR + CSLL', value: impostos, percent: pct(impostos), isTotal: false, indent: 0 },
    { label: '(=) Lucro Líquido', value: lucroLiquido, percent: pct(lucroLiquido), isTotal: true, indent: 0 },
    { label: '% Margem Líquida', value: pct(lucroLiquido), percent: pct(lucroLiquido), isTotal: true, indent: 0, type: 'margem' },
  ];
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Lucro líquido de um conjunto de transações — mesma matemática de computeDRE,
// mas sem montar as linhas de exibição. Não faz o split de resultado_financeiro
// por categoria-pai (soma tudo direto, diferente de computeDRE/computeCashFlowTotals).
export function computeNetProfit(transactions: Transaction[]): { receitaBruta: number; despesas: number; lucroLiquido: number } {
  const sumByType = (type: string) =>
    transactions
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

  return { receitaBruta, despesas, lucroLiquido };
}

// Sobe a árvore de categorias até a categoria-pai e verifica se é uma despesa
// financeira (resultado_financeiro cujo nome contém "despesa") — mesma heurística
// já usada dentro de computeDRE, extraída para ser reaproveitada por outras telas.
export function isDespesaFinanceira(categoryId: string, categories: Category[]): boolean {
  let current = categories.find((c) => c.id === categoryId);
  while (current?.parent_id) {
    const parent = categories.find((c) => c.id === current!.parent_id);
    if (!parent) break;
    current = parent;
  }
  return !!current && current.dre_type === 'resultado_financeiro' && current.name.toLowerCase().includes('despesa');
}

export type CashFlowBucket = 'entrada' | 'saida' | 'desconto' | 'neutro';

// Classifica um tipo de lançamento numa visão de FLUXO DE CAIXA (dinheiro
// entrando/saindo de verdade) — diferente do DRE (que mede lucro) e do Score de
// Saúde Financeira (que mede capacidade de poupança). 'desconto' tem bucket
// próprio porque reduz a entrada (não é uma saída à parte); 'depreciacao' é
// neutro porque não é uma saída de caixa real, é lançamento contábil.
export function classifyCashFlowBucket(
  dreType: string | undefined,
  categoryId: string,
  categories: Category[]
): CashFlowBucket {
  switch (dreType) {
    case 'receita':
    case 'outras_receitas':
      return 'entrada';
    case 'desconto':
      return 'desconto';
    case 'despesa':
    case 'custo':
    case 'impostos':
    case 'investimento':
      return 'saida';
    case 'depreciacao':
      return 'neutro';
    case 'resultado_financeiro':
      return isDespesaFinanceira(categoryId, categories) ? 'saida' : 'entrada';
    default:
      return 'saida';
  }
}

export interface CashFlowTotals {
  entradas: number;
  saidas: number;
}

// Soma COM SINAL dentro de cada bucket (sem Math.abs) — um estorno lançado com
// valor negativo (convenção já usada em toda a tela de Lançamentos) reduz o
// total corretamente, em vez de ser somado como se fosse um valor normal.
export function computeCashFlowTotals(transactions: Transaction[], categories: Category[]): CashFlowTotals {
  let entradas = 0;
  let saidas = 0;
  for (const t of transactions) {
    const bucket = classifyCashFlowBucket(t.categories?.dre_type, t.category_id, categories);
    const amount = Number(t.amount);
    if (bucket === 'entrada') entradas += amount;
    else if (bucket === 'saida') saidas += amount;
    else if (bucket === 'desconto') entradas -= amount;
  }
  return { entradas, saidas };
}

// Mesma matemática de computeDRE (investimento como despesa, resultado_financeiro
// dividido por categoria-pai), mas retornando só o Lucro Líquido final — para
// telas que só precisam do número, sem montar as linhas de exibição do DRE.
// Ao contrário de computeNetProfit, o valor bate exatamente com a linha
// "(=) LUCRO LÍQUIDO" que computeDRE mostraria para o mesmo período.
// Para meses futuros: quando uma categoria já tem parcela real lançada
// (is_installment), ela substitui a projeção manual dessa mesma categoria —
// dado real prevalece sobre estimativa, evitando contar o mesmo compromisso
// em dobro. Categorias sem parcela real mantêm a projeção normalmente.
export function mergeProjectionsWithInstallments<T extends { category_id: string }>(
  projections: T[],
  realInstallments: T[]
): T[] {
  const categoriesWithRealData = new Set(realInstallments.map((t) => t.category_id));
  const filteredProjections = projections.filter((p) => !categoriesWithRealData.has(p.category_id));
  return [...filteredProjections, ...realInstallments];
}

export function computeDRELucroLiquido(transactions: Transaction[], categories: Category[]): number {
  const sumByType = (type: string) =>
    transactions
      .filter((t) => t.categories?.dre_type === type)
      .reduce((sum, t) => sum + Number(t.amount), 0);

  const sumByParentId = (parentId: string) =>
    transactions
      .filter((t) => categories.find((c) => c.id === t.category_id)?.parent_id === parentId)
      .reduce((sum, t) => sum + Number(t.amount), 0);

  const receitaBruta = sumByType('receita');
  const descontos = sumByType('desconto');
  const receitaLiquida = receitaBruta - descontos;
  const custos = sumByType('custo');
  const lucroBruto = receitaLiquida - custos;
  const despesas = sumByType('despesa') + sumByType('investimento');
  const ebitda = lucroBruto - despesas;
  const depreciacao = sumByType('depreciacao');
  const ebit = ebitda - depreciacao;

  const parentCategories = categories.filter((c) => !c.parent_id);
  const rfParents = parentCategories.filter((c) => c.dre_type === 'resultado_financeiro');
  const rfReceitaParents = rfParents.filter((p) => !p.name.toLowerCase().includes('despesa'));
  const rfDespesaParents = rfParents.filter((p) => p.name.toLowerCase().includes('despesa'));
  const receitasFinanceiras = rfReceitaParents.reduce((sum, p) => sum + sumByParentId(p.id), 0);
  const despesasFinanceiras = rfDespesaParents.reduce((sum, p) => sum + sumByParentId(p.id), 0);
  const resultadoFinanceiro = receitasFinanceiras - despesasFinanceiras;

  const outrasReceitas = sumByType('outras_receitas');
  const lair = ebit + resultadoFinanceiro + outrasReceitas;
  const impostos = sumByType('impostos');
  return lair - impostos;
}

export interface DRETotals {
  receitaBruta: number;
  descontos: number;
  receitaLiquida: number;
  custos: number;
  lucroBruto: number;
  despesas: number;
  ebitda: number;
  depreciacao: number;
  ebit: number;
  resultadoFinanceiro: number;
  outrasReceitas: number;
  impostos: number;
  lucroLiquido: number;
}

// Mesma matemática de computeDRE (investimento como despesa, resultado_financeiro
// dividido por categoria-pai), mas retornando todos os totais intermediários como
// objeto plano em vez das linhas de exibição — para telas que precisam dos números
// de cada card/KPI individualmente (ex.: Dashboard), sem montar/ler de volta o
// array de linhas do DRE (lookup por label é frágil a mudanças de rótulo).
export function computeDRETotals(transactions: Transaction[], categories: Category[]): DRETotals {
  const sumByType = (type: string) =>
    transactions
      .filter((t) => t.categories?.dre_type === type)
      .reduce((sum, t) => sum + Number(t.amount), 0);

  const sumByParentId = (parentId: string) =>
    transactions
      .filter((t) => categories.find((c) => c.id === t.category_id)?.parent_id === parentId)
      .reduce((sum, t) => sum + Number(t.amount), 0);

  const receitaBruta = sumByType('receita');
  const descontos = sumByType('desconto');
  const receitaLiquida = receitaBruta - descontos;
  const custos = sumByType('custo');
  const lucroBruto = receitaLiquida - custos;
  const despesas = sumByType('despesa') + sumByType('investimento');
  const ebitda = lucroBruto - despesas;
  const depreciacao = sumByType('depreciacao');
  const ebit = ebitda - depreciacao;

  const parentCategories = categories.filter((c) => !c.parent_id);
  const rfParents = parentCategories.filter((c) => c.dre_type === 'resultado_financeiro');
  const rfReceitaParents = rfParents.filter((p) => !p.name.toLowerCase().includes('despesa'));
  const rfDespesaParents = rfParents.filter((p) => p.name.toLowerCase().includes('despesa'));
  const receitasFinanceiras = rfReceitaParents.reduce((sum, p) => sum + sumByParentId(p.id), 0);
  const despesasFinanceiras = rfDespesaParents.reduce((sum, p) => sum + sumByParentId(p.id), 0);
  const resultadoFinanceiro = receitasFinanceiras - despesasFinanceiras;

  const outrasReceitas = sumByType('outras_receitas');
  const lair = ebit + resultadoFinanceiro + outrasReceitas;
  const impostos = sumByType('impostos');
  const lucroLiquido = lair - impostos;

  return {
    receitaBruta, descontos, receitaLiquida, custos, lucroBruto, despesas, ebitda,
    depreciacao, ebit, resultadoFinanceiro, outrasReceitas, impostos, lucroLiquido,
  };
}
