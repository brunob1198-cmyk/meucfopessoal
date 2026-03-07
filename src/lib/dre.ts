import { Category } from '@/hooks/useCategories';

interface Transaction {
  amount: number;
  category_id: string;
  categories: { name: string; dre_type: string; parent_id: string | null } | null;
}

export interface DRELine {
  label: string;
  value: number;
  percent: number;
  isTotal: boolean;
  indent: number;
  type?: string;
}

export function computeDRE(
  transactions: Transaction[],
  categories: Category[]
): DRELine[] {
  const sumByType = (type: string) =>
    transactions
      .filter((t) => t.categories?.dre_type === type)
      .reduce((sum, t) => sum + Number(t.amount), 0);

  const sumByParentName = (parentName: string) => {
    const parent = categories.find(
      (c) => c.name === parentName && !c.parent_id
    );
    if (!parent) return 0;
    return transactions
      .filter((t) => {
        const cat = categories.find((c) => c.id === t.category_id);
        return cat?.parent_id === parent.id;
      })
      .reduce((sum, t) => sum + Number(t.amount), 0);
  };

  const detailByParent = (parentName: string): DRELine[] => {
    const parent = categories.find(
      (c) => c.name === parentName && !c.parent_id
    );
    if (!parent) return [];
    const children = categories.filter((c) => c.parent_id === parent.id);
    return children
      .map((child) => {
        const value = transactions
          .filter((t) => t.category_id === child.id)
          .reduce((sum, t) => sum + Number(t.amount), 0);
        return { label: child.name, value, percent: 0, isTotal: false, indent: 2 };
      })
      .filter((line) => line.value !== 0);
  };

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
  const investimentos = sumByType('investimento');

  const pct = (v: number) => (receitaBruta > 0 ? (v / receitaBruta) * 100 : 0);

  // Build parent categories for detail
  const parentCategories = categories.filter((c) => !c.parent_id);

  const lines: DRELine[] = [];

  // Receita Bruta with details
  lines.push({ label: 'RECEITA BRUTA', value: receitaBruta, percent: 100, isTotal: true, indent: 0, type: 'receita' });
  parentCategories
    .filter((p) => p.dre_type === 'receita')
    .forEach((p) => {
      detailByParent(p.name).forEach((d) => lines.push(d));
    });

  lines.push({ label: '(-) DESCONTOS INCIDENTES', value: descontos, percent: pct(descontos), isTotal: false, indent: 0, type: 'desconto' });
  parentCategories
    .filter((p) => p.dre_type === 'desconto')
    .forEach((p) => {
      detailByParent(p.name).forEach((d) => lines.push(d));
    });

  lines.push({ label: '= RECEITA LÍQUIDA', value: receitaLiquida, percent: pct(receitaLiquida), isTotal: true, indent: 0 });

  lines.push({ label: '(-) CUSTOS', value: custos, percent: pct(custos), isTotal: false, indent: 0, type: 'custo' });
  parentCategories
    .filter((p) => p.dre_type === 'custo')
    .forEach((p) => {
      detailByParent(p.name).forEach((d) => lines.push(d));
    });

  lines.push({ label: '= LUCRO BRUTO', value: lucroBruto, percent: pct(lucroBruto), isTotal: true, indent: 0 });

  lines.push({ label: '(-) DESPESAS', value: despesas, percent: pct(despesas), isTotal: false, indent: 0, type: 'despesa' });
  parentCategories
    .filter((p) => p.dre_type === 'despesa')
    .forEach((p) => {
      lines.push({ label: p.name, value: sumByParentName(p.name), percent: pct(sumByParentName(p.name)), isTotal: false, indent: 1 });
      detailByParent(p.name).forEach((d) => lines.push(d));
    });

  lines.push({ label: '= EBITDA', value: ebitda, percent: pct(ebitda), isTotal: true, indent: 0 });
  lines.push({ label: '(-) DEPRECIAÇÃO', value: depreciacao, percent: pct(depreciacao), isTotal: false, indent: 0 });
  lines.push({ label: '= EBIT', value: ebit, percent: pct(ebit), isTotal: true, indent: 0 });
  lines.push({ label: '(+/-) RESULTADO FINANCEIRO', value: resultadoFinanceiro, percent: pct(resultadoFinanceiro), isTotal: false, indent: 0 });
  lines.push({ label: '(+) OUTRAS RECEITAS', value: outrasReceitas, percent: pct(outrasReceitas), isTotal: false, indent: 0 });
  lines.push({ label: '= LAIR', value: lair, percent: pct(lair), isTotal: true, indent: 0 });
  lines.push({ label: '(-) IMPOSTOS', value: impostos, percent: pct(impostos), isTotal: false, indent: 0 });
  lines.push({ label: '= LUCRO LÍQUIDO', value: lucroLiquido, percent: pct(lucroLiquido), isTotal: true, indent: 0 });

  if (investimentos > 0) {
    lines.push({ label: 'INVESTIMENTOS', value: investimentos, percent: pct(investimentos), isTotal: false, indent: 0, type: 'investimento' });
    parentCategories
      .filter((p) => p.dre_type === 'investimento')
      .forEach((p) => {
        detailByParent(p.name).forEach((d) => lines.push(d));
      });
  }

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

  const pct = (v: number) => (receitaBruta > 0 ? (v / receitaBruta) * 100 : 0);

  return [
    { label: 'Receita Bruta', value: receitaBruta, percent: 100, isTotal: false, indent: 0 },
    { label: 'Impostos incidentes', value: descontos, percent: pct(descontos), isTotal: false, indent: 0 },
    { label: 'Receita Líquida', value: receitaLiquida, percent: pct(receitaLiquida), isTotal: true, indent: 0 },
    { label: 'Custos', value: custos, percent: pct(custos), isTotal: false, indent: 0 },
    { label: 'Lucro Bruto', value: lucroBruto, percent: pct(lucroBruto), isTotal: true, indent: 0 },
    { label: 'Despesas Fixas', value: despesas, percent: pct(despesas), isTotal: false, indent: 0 },
    { label: 'EBITDA', value: ebitda, percent: pct(ebitda), isTotal: true, indent: 0 },
    { label: 'Depreciação', value: depreciacao, percent: pct(depreciacao), isTotal: false, indent: 0 },
    { label: 'Lucro Operacional (EBIT)', value: ebit, percent: pct(ebit), isTotal: true, indent: 0 },
    { label: 'Resultado Financeiro', value: resultadoFinanceiro, percent: pct(resultadoFinanceiro), isTotal: false, indent: 0 },
    { label: 'Outras receitas', value: outrasReceitas, percent: pct(outrasReceitas), isTotal: false, indent: 0 },
    { label: 'LAIR', value: lair, percent: pct(lair), isTotal: true, indent: 0 },
    { label: 'IR + CSLL', value: impostos, percent: pct(impostos), isTotal: false, indent: 0 },
    { label: 'Lucro Líquido', value: lucroLiquido, percent: pct(lucroLiquido), isTotal: true, indent: 0 },
  ];
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
