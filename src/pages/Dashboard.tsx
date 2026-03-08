import { useMemo, useRef } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useProjections } from '@/hooks/useProjections';
import { usePersistedFilter } from '@/hooks/usePersistedFilter';
import { MonthRangePicker } from '@/components/MonthRangePicker';
import { formatBRL } from '@/lib/dre';
import { format, eachMonthOfInterval, startOfMonth, endOfMonth, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, TrendingDown, DollarSign, ImageDown } from 'lucide-react';
import { ExportMenu } from '@/components/ExportMenu';
import { exportChartAsPNG } from '@/lib/exportChart';
import { Button } from '@/components/ui/button';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, LineChart, Line,
} from 'recharts';

const COLORS = [
  'hsl(220, 70%, 45%)', 'hsl(152, 60%, 40%)', 'hsl(0, 72%, 51%)',
  'hsl(38, 92%, 50%)', 'hsl(280, 60%, 50%)', 'hsl(180, 60%, 40%)',
  'hsl(330, 60%, 50%)', 'hsl(60, 70%, 45%)',
];

export default function Dashboard() {
  const filter = usePersistedFilter('dashboard');
  const { data: transactions, isLoading: txLoading } = useTransactions(filter.startDate, filter.endDate);
  const { data: categories, isLoading: catLoading } = useCategories();
  const { data: projections } = useProjections(filter.startDate, filter.endDate);

  const loading = txLoading || catLoading;
  const pieChartRef = useRef<HTMLDivElement>(null);
  const lineChartRef = useRef<HTMLDivElement>(null);
  const barChartRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const currentMonthEnd = endOfMonth(now);

  const months = useMemo(() => {
    const start = filter.parseMonth(filter.startMonth);
    const end = filter.parseMonth(filter.endMonth);
    return eachMonthOfInterval({ start, end }).map(d => format(d, 'yyyy-MM'));
  }, [filter.startMonth, filter.endMonth]);

  const allData = useMemo(() => {
    if (!categories) return { txByMonth: new Map() as Map<string, any[]> };
    const txByMonth = new Map<string, any[]>();

    (transactions || []).forEach((t: any) => {
      const m = t.date.substring(0, 7);
      if (!txByMonth.has(m)) txByMonth.set(m, []);
      txByMonth.get(m)!.push(t);
    });

    (projections || []).forEach((p: any) => {
      const m = typeof p.month === 'string' ? p.month.substring(0, 7) : '';
      const monthDate = new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1);
      if (isAfter(startOfMonth(monthDate), currentMonthEnd)) {
        if (!txByMonth.has(m)) txByMonth.set(m, []);
        txByMonth.get(m)!.push({
          amount: p.amount,
          category_id: p.category_id,
          categories: p.categories,
          date: p.month,
          _projected: true,
        });
      }
    });

    return { txByMonth };
  }, [transactions, projections, categories, currentMonthEnd]);

  const sumByType = (type: string) => {
    let total = 0;
    allData.txByMonth.forEach(txs => {
      txs.forEach((t: any) => {
        if (t.categories?.dre_type === type) total += Number(t.amount);
      });
    });
    return total;
  };

  const receitaBruta = sumByType('receita');
  const descontos = sumByType('desconto');
  const despesas = sumByType('despesa');
  const custos = sumByType('custo');
  const receitaLiquida = receitaBruta - descontos;
  const lucroBruto = receitaLiquida - custos;
  const ebitda = lucroBruto - despesas;
  const lucroLiquido = ebitda - sumByType('depreciacao') + sumByType('resultado_financeiro') + sumByType('outras_receitas') - sumByType('impostos');

  const pieData = useMemo(() => {
    if (!categories) return [];
    const parentCats = categories.filter((c) => !c.parent_id && c.dre_type === 'despesa');
    return parentCats.map((parent) => {
      const children = categories.filter((c) => c.parent_id === parent.id);
      const childIds = new Set(children.map((c) => c.id));
      let total = 0;
      allData.txByMonth.forEach(txs => {
        txs.forEach((t: any) => { if (childIds.has(t.category_id)) total += Number(t.amount); });
      });
      return { name: parent.name, value: total };
    }).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  }, [categories, allData]);

  const stackedBarData = useMemo(() => {
    if (!categories) return { data: [] as any[], keys: [] as string[] };
    const parentCats = categories.filter((c) => !c.parent_id && c.dre_type === 'despesa');
    const catNames = parentCats.map(c => c.name);
    const childMap = new Map<string, string>();
    parentCats.forEach(p => {
      categories.filter(c => c.parent_id === p.id).forEach(c => childMap.set(c.id, p.name));
    });

    const data = months.map(m => {
      const row: any = {
        mes: format(new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1), 'MMM/yy', { locale: ptBR }),
      };
      catNames.forEach(n => row[n] = 0);
      const txs = allData.txByMonth.get(m) || [];
      txs.forEach((t: any) => {
        const pName = childMap.get(t.category_id);
        if (pName) row[pName] = (row[pName] || 0) + Number(t.amount);
      });
      return row;
    });

    return { data, keys: catNames.filter(n => data.some(d => d[n] > 0)) };
  }, [categories, months, allData]);

  const lineData = useMemo(() => {
    if (!categories) return [];
    return months.map(m => {
      const txs = allData.txByMonth.get(m) || [];
      const sumType = (type: string) => txs.filter((t: any) => t.categories?.dre_type === type).reduce((s: number, t: any) => s + Number(t.amount), 0);
      const rec = sumType('receita');
      const desc = sumType('desconto');
      const cust = sumType('custo');
      const desp = sumType('despesa');
      const dep = sumType('depreciacao');
      const rf = sumType('resultado_financeiro');
      const or = sumType('outras_receitas');
      const imp = sumType('impostos');
      const rl = rec - desc;
      const lb = rl - cust;
      const ebitdaM = lb - desp;
      const ll = ebitdaM - dep + rf + or - imp;
      return {
        mes: format(new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1), 'MMM/yy', { locale: ptBR }),
        'Receita Bruta': rec,
        'Despesas + Custos': desp + cust,
        'Lucro Líquido': ll,
      };
    });
  }, [categories, months, allData]);

  // Build detailed table data for export
  const detailedTableData = useMemo(() => {
    const rows: { [key: string]: string | number }[] = [];
    rows.push({
      Indicador: 'Receita Bruta',
      Valor: formatBRL(receitaBruta),
    });
    rows.push({
      Indicador: '(-) Descontos',
      Valor: formatBRL(descontos),
    });
    rows.push({
      Indicador: '= Receita Líquida',
      Valor: formatBRL(receitaLiquida),
    });
    rows.push({
      Indicador: '(-) Custos',
      Valor: formatBRL(custos),
    });
    rows.push({
      Indicador: '= Lucro Bruto',
      Valor: formatBRL(lucroBruto),
    });
    rows.push({
      Indicador: '(-) Despesas Operacionais',
      Valor: formatBRL(despesas),
    });
    rows.push({
      Indicador: '= EBITDA',
      Valor: formatBRL(ebitda),
    });
    rows.push({
      Indicador: '= LUCRO LÍQUIDO',
      Valor: formatBRL(lucroLiquido),
    });
    rows.push({ Indicador: '', Valor: '' });
    rows.push({ Indicador: 'EVOLUÇÃO MENSAL', Valor: '' });
    lineData.forEach(d => {
      rows.push({
        Indicador: d.mes,
        'Receita Bruta': formatBRL(d['Receita Bruta']),
        'Despesas + Custos': formatBRL(d['Despesas + Custos']),
        'Lucro Líquido': formatBRL(d['Lucro Líquido']),
      });
    });
    if (pieData.length > 0) {
      rows.push({ Indicador: '', Valor: '' });
      rows.push({ Indicador: 'DISTRIBUIÇÃO DE DESPESAS', Valor: '' });
      pieData.forEach(d => {
        rows.push({ Indicador: d.name, Valor: formatBRL(d.value) });
      });
    }
    return rows;
  }, [receitaBruta, descontos, receitaLiquida, custos, lucroBruto, despesas, ebitda, lucroLiquido, lineData, pieData]);

  const periodLabel = filter.startMonth === filter.endMonth
    ? format(filter.parseMonth(filter.startMonth), "MMMM 'de' yyyy", { locale: ptBR })
    : `${format(filter.parseMonth(filter.startMonth), 'MMM/yy', { locale: ptBR })} a ${format(filter.parseMonth(filter.endMonth), 'MMM/yy', { locale: ptBR })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground capitalize">{periodLabel}</p>
        </div>
        <MonthRangePicker
          startMonth={filter.startMonth}
          endMonth={filter.endMonth}
          onStartChange={filter.setStartMonth}
          onEndChange={filter.setEndMonth}
          onYearClick={() => filter.setFullYear()}
        />
        <ExportMenu
          filename={`dashboard-${filter.startMonth}-${filter.endMonth}`}
          title={`Dashboard — ${periodLabel}`}
          getData={() => detailedTableData}
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground font-medium">Receita Líquida</p><p className="text-lg font-bold tabular-nums">{formatBRL(receitaLiquida)}</p></div><DollarSign className="h-8 w-8 text-[hsl(var(--chart-receita))] opacity-60" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground font-medium">Despesas</p><p className="text-lg font-bold tabular-nums">{formatBRL(despesas)}</p></div><TrendingDown className="h-8 w-8 text-destructive opacity-60" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground font-medium">EBITDA</p><p className={`text-lg font-bold tabular-nums ${ebitda < 0 ? 'text-destructive' : ''}`}>{formatBRL(ebitda)}</p></div><TrendingUp className="h-8 w-8 text-primary opacity-60" /></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground font-medium">Lucro Líquido</p><p className={`text-lg font-bold tabular-nums ${lucroLiquido < 0 ? 'text-destructive' : ''}`}>{formatBRL(lucroLiquido)}</p></div><TrendingUp className="h-8 w-8 text-[hsl(var(--chart-receita))] opacity-60" /></div></CardContent></Card>
      </div>

      {/* Row 1: Pie + Evolução DRE Linha */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Distribuição de Despesas (%)</CardTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => exportChartAsPNG(pieChartRef.current, 'distribuicao-despesas')} title="Exportar gráfico">
              <ImageDown className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados para o período</p>
            ) : (
              <div ref={pieChartRef}>
              <ResponsiveContainer width="100%" height={280}>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Evolução DRE Mensal</CardTitle></CardHeader>
          <CardContent>
            {lineData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="Receita Bruta" stroke="hsl(220, 70%, 45%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Despesas + Custos" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Lucro Líquido" stroke="hsl(152, 60%, 40%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Stacked bar expenses */}
      <Card>
        <CardHeader><CardTitle className="text-base">Gastos por Categoria (Coluna Empilhada)</CardTitle></CardHeader>
        <CardContent>
          {stackedBarData.data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={stackedBarData.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Legend />
                {stackedBarData.keys.map((key, i) => (
                  <Bar key={key} dataKey={key} stackId="expenses" fill={COLORS[i % COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
