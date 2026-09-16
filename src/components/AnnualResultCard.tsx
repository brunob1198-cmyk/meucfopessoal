import { useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImageDown } from 'lucide-react';
import { exportChartAsPNG } from '@/lib/exportChart';
import { formatBRL, computeDRETotals, computeDRELucroLiquido } from '@/lib/dre';
import { useCategories } from '@/hooks/useCategories';
import { useTransactions } from '@/hooks/useTransactions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell, ReferenceLine,
} from 'recharts';

const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: 'hsl(200 35% 12% / 0.95)',
    border: '1px solid hsl(200 25% 20%)',
    borderRadius: '8px',
    backdropFilter: 'blur(8px)',
    color: 'hsl(var(--foreground))',
  },
  labelStyle: { color: 'hsl(var(--foreground))' },
  itemStyle: { color: 'hsl(var(--foreground))' },
};

const SUPERAVIT_COLOR = 'hsl(160, 60%, 45%)';
const DEFICIT_COLOR = 'hsl(0, 65%, 58%)';

// Formata "yyyy-MM" construindo a data com ano/mês locais (evita o bug de
// fuso horário de `new Date("yyyy-MM-01")`, que é interpretado como UTC).
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return format(new Date(y, m - 1, 1), 'MMMM', { locale: ptBR });
}

export function AnnualResultCard() {
  const { data: transactions } = useTransactions();
  const { data: categories } = useCategories();
  const chartRef = useRef<HTMLDivElement>(null);

  const yearlyData = useMemo(() => {
    if (!categories || !transactions) return [];

    const txByYear = new Map<string, any[]>();
    const txByMonth = new Map<string, any[]>();
    transactions.forEach((t: any) => {
      if (!t.date) return;
      const year = t.date.substring(0, 4);
      const month = t.date.substring(0, 7);
      if (!txByYear.has(year)) txByYear.set(year, []);
      txByYear.get(year)!.push(t);
      if (!txByMonth.has(month)) txByMonth.set(month, []);
      txByMonth.get(month)!.push(t);
    });

    const years = Array.from(txByYear.keys()).sort();

    return years.map((year) => {
      const yearTxs = txByYear.get(year) || [];
      const totals = computeDRETotals(yearTxs, categories);
      const monthsInYear = Array.from(txByMonth.keys()).filter((m) => m.startsWith(year)).sort();
      const monthsElapsed = monthsInYear.length;
      const monthsNoVermelho = monthsInYear.filter(
        (m) => computeDRELucroLiquido(txByMonth.get(m) || [], categories) < 0
      ).length;
      const despesas = totals.receitaLiquida - totals.lucroLiquido;
      const margem = totals.receitaLiquida !== 0 ? (totals.lucroLiquido / totals.receitaLiquida) * 100 : 0;
      return {
        year,
        receitaLiquida: totals.receitaLiquida,
        despesas,
        resultado: totals.lucroLiquido,
        margem,
        monthsElapsed,
        monthsNoVermelho,
        firstMonth: monthsInYear[0],
        lastMonth: monthsInYear[monthsInYear.length - 1],
      };
    });
  }, [transactions, categories]);

  const chartData = useMemo(
    () => yearlyData.map((y) => ({ ano: y.year, resultado: y.resultado })),
    [yearlyData]
  );

  const totals = useMemo(() => {
    const receitaLiquida = yearlyData.reduce((s, y) => s + y.receitaLiquida, 0);
    const despesas = yearlyData.reduce((s, y) => s + y.despesas, 0);
    const resultado = yearlyData.reduce((s, y) => s + y.resultado, 0);
    const monthsElapsed = yearlyData.reduce((s, y) => s + y.monthsElapsed, 0);
    const monthsNoVermelho = yearlyData.reduce((s, y) => s + y.monthsNoVermelho, 0);
    const margem = receitaLiquida !== 0 ? (resultado / receitaLiquida) * 100 : 0;
    return { receitaLiquida, despesas, resultado, margem, monthsElapsed, monthsNoVermelho };
  }, [yearlyData]);

  const partialYear = yearlyData.length > 0 && yearlyData[yearlyData.length - 1].monthsElapsed < 12 ?
    yearlyData[yearlyData.length - 1] :
    null;

  const partialCaption = partialYear && partialYear.firstMonth && partialYear.lastMonth ?
    `${partialYear.year} = ${monthLabel(partialYear.firstMonth)} a ${monthLabel(partialYear.lastMonth)} (${partialYear.monthsElapsed} meses realizados)` :
    null;

  if (yearlyData.length === 0) return null;

  return (
    <Card className="glass-card float-card border-border/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-display">Resultado Líquido por Exercício</CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => exportChartAsPNG(chartRef.current, 'resultado-liquido-por-exercicio')} title="Exportar gráfico">
          <ImageDown className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div ref={chartRef}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 24, right: 10, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 25% 18% / 0.5)" vertical={false} />
              <XAxis dataKey="ano" tick={{ fontSize: 12, fill: 'hsl(207 25% 60%)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(207 25% 60%)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatBRL(v)} {...CHART_TOOLTIP_STYLE} />
              <ReferenceLine y={0} stroke="hsl(200 25% 30%)" />
              <Bar dataKey="resultado" maxBarSize={70} radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.resultado >= 0 ? SUPERAVIT_COLOR : DEFICIT_COLOR} />)}
                <LabelList
                  dataKey="resultado"
                  position="top"
                  formatter={(v: number) => `${v >= 0 ? '+' : ''}${formatBRL(v)}`}
                  style={{ fontSize: 11, fontWeight: 600, fill: 'hsl(var(--foreground))' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SUPERAVIT_COLOR }} /> Superávit</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: DEFICIT_COLOR }} /> Déficit</span>
          {partialCaption && <span className="italic capitalize">{partialCaption}</span>}
        </div>

        <div className="overflow-x-auto">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Consolidado anual</p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs">
                <th className="text-left py-1.5 px-2 font-semibold">Exercício</th>
                <th className="text-right py-1.5 px-2 font-semibold">Receita Líquida</th>
                <th className="text-right py-1.5 px-2 font-semibold">Despesas</th>
                <th className="text-right py-1.5 px-2 font-semibold">Resultado</th>
                <th className="text-right py-1.5 px-2 font-semibold">Margem</th>
                <th className="text-right py-1.5 px-2 font-semibold">Meses no Vermelho</th>
              </tr>
            </thead>
            <tbody>
              {yearlyData.map((y) => (
                <tr key={y.year} className={`border-b border-border/50 ${y.resultado < 0 ? 'bg-destructive/10' : ''}`}>
                  <td className="py-1.5 px-2 font-medium text-foreground whitespace-nowrap">
                    {y.year}{y.monthsElapsed < 12 ? ` (${y.monthsElapsed}m)` : ''}
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-foreground whitespace-nowrap">{formatBRL(y.receitaLiquida)}</td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-foreground whitespace-nowrap">{formatBRL(y.despesas)}</td>
                  <td className={`py-1.5 px-2 text-right tabular-nums font-medium whitespace-nowrap ${y.resultado < 0 ? 'text-destructive' : 'text-emerald-400'}`}>
                    {y.resultado >= 0 ? '+' : ''}{formatBRL(y.resultado)}
                  </td>
                  <td className={`py-1.5 px-2 text-right tabular-nums whitespace-nowrap ${y.margem < 0 ? 'text-destructive' : 'text-foreground'}`}>
                    {y.margem.toFixed(1)}%
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                    {y.monthsNoVermelho} / {y.monthsElapsed}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-primary/30 font-bold">
                <td className="py-1.5 px-2 text-foreground whitespace-nowrap">Acumulado {totals.monthsElapsed} meses</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-foreground whitespace-nowrap">{formatBRL(totals.receitaLiquida)}</td>
                <td className="py-1.5 px-2 text-right tabular-nums text-foreground whitespace-nowrap">{formatBRL(totals.despesas)}</td>
                <td className={`py-1.5 px-2 text-right tabular-nums whitespace-nowrap ${totals.resultado < 0 ? 'text-destructive' : 'text-emerald-400'}`}>
                  {totals.resultado >= 0 ? '+' : ''}{formatBRL(totals.resultado)}
                </td>
                <td className={`py-1.5 px-2 text-right tabular-nums whitespace-nowrap ${totals.margem < 0 ? 'text-destructive' : 'text-foreground'}`}>
                  {totals.margem.toFixed(1)}%
                </td>
                <td className="py-1.5 px-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                  {totals.monthsNoVermelho} / {totals.monthsElapsed}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
