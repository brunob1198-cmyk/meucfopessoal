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
    .filter((p) => p.dre_type === 'despesa')
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

  // Investimentos
  parentCategories
    .filter((p) => p.dre_type === 'investimento')
    .forEach((p) => {
      lines.push({
        label: p.name,
        value: sumByParentId(p.id),
        percent: pct(sumByParentId(p.id)),
        isTotal: false,
        indent: 0,
        type: 'investimento',
        isGroupHeader: true,
        groupId: p.id,
      });
      detailByParentId(p.id).forEach((d) => lines.push(d));
    });

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
  const despesas = sumByType('despesa');
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
    { label: '(-) Impostos incidentes', value: descontos, percent: pct(descontos), isTotal: false, indent: 0 },
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
