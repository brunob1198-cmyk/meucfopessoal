import { useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ImageDown } from 'lucide-react';
import { exportChartAsPNG } from '@/lib/exportChart';
import { formatBRL } from '@/lib/dre';
import { Category } from '@/hooks/useCategories';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const COLORS = [
  'hsl(220, 70%, 45%)', 'hsl(152, 60%, 40%)', 'hsl(0, 72%, 51%)',
  'hsl(38, 92%, 50%)', 'hsl(280, 60%, 50%)', 'hsl(180, 60%, 40%)',
  'hsl(330, 60%, 50%)', 'hsl(60, 70%, 45%)', 'hsl(200, 70%, 50%)',
  'hsl(10, 80%, 55%)', 'hsl(120, 50%, 40%)', 'hsl(300, 50%, 45%)',
];

type ViewOption = {
  label: string;
  dreTypes: string[];
  parentFilter?: string; // specific parent category name
};

const VIEW_OPTIONS: ViewOption[] = [
  { label: 'Visão Geral (Clusters)', dreTypes: ['receita', 'desconto', 'custo', 'despesa', 'investimento', 'depreciacao', 'resultado_financeiro', 'outras_receitas', 'impostos'] },
  { label: 'Renda Familiar', dreTypes: ['receita'] },
  { label: 'Somente Despesas', dreTypes: ['despesa'] },
  { label: 'Habitação', dreTypes: ['despesa'], parentFilter: 'HABITAÇÃO' },
  { label: 'Saúde', dreTypes: ['despesa'], parentFilter: 'SAÚDE' },
  { label: 'Automóvel', dreTypes: ['despesa'], parentFilter: 'AUTOMÓVEL' },
  { label: 'Despesas Pessoais', dreTypes: ['despesa'], parentFilter: 'DESPESAS PESSOAIS' },
  { label: 'Restaurante', dreTypes: ['despesa'], parentFilter: 'RESTAURANTE' },
  { label: 'Lazer', dreTypes: ['despesa'], parentFilter: 'LAZER' },
  { label: 'Estudos', dreTypes: ['despesa'], parentFilter: 'ESTUDOS' },
  { label: 'Investimentos', dreTypes: ['investimento'] },
  { label: 'Custos', dreTypes: ['custo'] },
  { label: 'Descontos', dreTypes: ['desconto'] },
];

interface YearlyEvolutionProps {
  transactions: any[];
  categories: Category[];
}

export function YearlyEvolution({ transactions, categories }: YearlyEvolutionProps) {
  const [viewIndex, setViewIndex] = useState(0);
  const chartRef = useRef<HTMLDivElement>(null);
  const view = VIEW_OPTIONS[viewIndex];

  // Get all years from transactions
  const years = useMemo(() => {
    const yearSet = new Set<number>();
    (transactions || []).forEach((t: any) => {
      const y = Number(t.date?.substring(0, 4));
      if (y) yearSet.add(y);
    });
    return Array.from(yearSet).sort((a, b) => b - a); // descending
  }, [transactions]);

  // Build category map
  const catMap = useMemo(() => {
    const m = new Map<string, Category>();
    (categories || []).forEach(c => m.set(c.id, c));
    return m;
  }, [categories]);

  // Determine which rows to show based on view
  const { rows, rowNames } = useMemo(() => {
    if (!categories || categories.length === 0) return { rows: [] as any[], rowNames: [] as string[] };

    const isSpecificParent = !!view.parentFilter;

    if (isSpecificParent) {
      // Show children of the specific parent
      const parent = categories.find(c => !c.parent_id && c.name.toUpperCase() === view.parentFilter!.toUpperCase());
      if (!parent) return { rows: [], rowNames: [] };
      const children = categories.filter(c => c.parent_id === parent.id);
      const names = children.map(c => c.name);
      const rowData = children.map(child => {
        const yearTotals: Record<string, number> = {};
        years.forEach(y => {
          const total = (transactions || [])
            .filter((t: any) => t.category_id === child.id && t.date?.startsWith(String(y)))
            .reduce((s: number, t: any) => s + Number(t.amount), 0);
          yearTotals[String(y)] = total;
        });
        return { name: child.name, ...yearTotals };
      });
      return { rows: rowData, rowNames: names };
    }

    // Show parent-level clusters
    const parentCats = categories.filter(c => !c.parent_id && view.dreTypes.includes(c.dre_type));
    const names = parentCats.map(c => c.name);
    const rowData = parentCats.map(parent => {
      const childIds = new Set(categories.filter(c => c.parent_id === parent.id).map(c => c.id));
      // Also include the parent itself if it has direct transactions
      childIds.add(parent.id);
      const yearTotals: Record<string, number> = {};
      years.forEach(y => {
        const total = (transactions || [])
          .filter((t: any) => childIds.has(t.category_id) && t.date?.startsWith(String(y)))
          .reduce((s: number, t: any) => s + Number(t.amount), 0);
        yearTotals[String(y)] = total;
      });
      return { name: parent.name, ...yearTotals };
    });
    return { rows: rowData.filter(r => years.some(y => r[String(y)] > 0)), rowNames: names };
  }, [categories, transactions, years, view]);

  // Compute year-over-year percentages for header
  const yearPercentages = useMemo(() => {
    const pcts: Record<string, string> = {};
    for (let i = 0; i < years.length - 1; i++) {
      const curr = years[i];
      const prev = years[i + 1];
      const currTotal = rows.reduce((s, r) => s + (r[String(curr)] || 0), 0);
      const prevTotal = rows.reduce((s, r) => s + (r[String(prev)] || 0), 0);
      if (prevTotal > 0) {
        pcts[String(curr)] = `${Math.round((currTotal / prevTotal) * 100)}%`;
      }
    }
    return pcts;
  }, [rows, years]);

  // Chart data: years as X axis, each row as a stacked bar
  const chartData = useMemo(() => {
    return [...years].reverse().map(y => {
      const entry: any = { ano: String(y) };
      rows.forEach(r => {
        entry[r.name] = r[String(y)] || 0;
      });
      return entry;
    });
  }, [years, rows]);

  const chartKeys = rows.map(r => r.name).filter(name => chartData.some(d => d[name] > 0));

  if (years.length === 0) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-4 flex-wrap">
          <CardTitle className="text-base">Evolução Anual por Categoria</CardTitle>
          <Select value={String(viewIndex)} onValueChange={(v) => setViewIndex(Number(v))}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VIEW_OPTIONS.map((opt, i) => (
                <SelectItem key={i} value={String(i)}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados para esta visão</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 font-semibold text-muted-foreground sticky left-0 bg-card z-10 min-w-[180px]">CLUSTER</th>
                  {years.map(y => (
                    <th key={y} className="text-right py-2 px-3 font-semibold text-muted-foreground min-w-[110px]">
                      <div>{y}</div>
                      {yearPercentages[String(y)] && (
                        <div className="text-xs font-normal text-primary">{yearPercentages[String(y)]}</div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-2 px-3 font-medium text-foreground sticky left-0 bg-card z-10">{row.name}</td>
                    {years.map(y => (
                      <td key={y} className="py-2 px-3 text-right tabular-nums text-foreground">
                        {row[String(y)] > 0 ? formatBRL(row[String(y)]) : '–'}
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="border-t-2 border-primary/30 font-bold">
                  <td className="py-2 px-3 text-foreground sticky left-0 bg-card z-10">TOTAL</td>
                  {years.map(y => {
                    const total = rows.reduce((s, r) => s + (r[String(y)] || 0), 0);
                    return (
                      <td key={y} className="py-2 px-3 text-right tabular-nums text-foreground">
                        {total > 0 ? formatBRL(total) : '–'}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Stacked bar chart for yearly data */}
      {chartKeys.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Evolução Anual — {view.label}</CardTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => exportChartAsPNG(chartRef.current, `evolucao-anual-${view.label}`)} title="Exportar gráfico">
              <ImageDown className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <div ref={chartRef}>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="ano" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {chartKeys.map((key, i) => (
                    <Bar key={key} dataKey={key} stackId="yearly" fill={COLORS[i % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
