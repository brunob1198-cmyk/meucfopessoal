import { useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { FinancialHealthScoreCard } from '@/components/FinancialHealthScoreCard';
import { YearlyEvolution } from '@/components/YearlyEvolution';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useProjections } from '@/hooks/useProjections';
import { usePersistedFilter } from '@/hooks/usePersistedFilter';
import { MonthRangePicker } from '@/components/MonthRangePicker';
import { formatBRL } from '@/lib/dre';
import { format, eachMonthOfInterval, startOfMonth, endOfMonth, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, TrendingDown, DollarSign, ImageDown, Wallet, BarChart3 } from 'lucide-react';
import { ExportMenu } from '@/components/ExportMenu';
import { exportChartAsPNG } from '@/lib/exportChart';
import { Button } from '@/components/ui/button';
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, LineChart, Line, LabelList } from
'recharts';

const COLORS = [
'hsl(220, 50%, 42%)', 'hsl(152, 45%, 38%)', 'hsl(0, 50%, 45%)',
'hsl(38, 65%, 45%)', 'hsl(280, 40%, 45%)', 'hsl(180, 40%, 38%)',
'hsl(330, 40%, 42%)', 'hsl(60, 45%, 40%)', 'hsl(200, 50%, 42%)',
'hsl(10, 55%, 45%)', 'hsl(120, 35%, 38%)', 'hsl(300, 35%, 40%)'];


const cardVariant = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' as const }
  })
};

export default function Dashboard() {
  const filter = usePersistedFilter('dashboard');
  const { data: transactions, isLoading: txLoading } = useTransactions(filter.startDate, filter.endDate);
  const { data: categories, isLoading: catLoading } = useCategories();
  const { data: projections } = useProjections(filter.startDate, filter.endDate);

  const loading = txLoading || catLoading;
  const pieChartRef = useRef<HTMLDivElement>(null);
  const lineChartRef = useRef<HTMLDivElement>(null);
  const barChartRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const currentMonthEnd = endOfMonth(now);

  const months = useMemo(() => {
    const start = filter.parseMonth(filter.startMonth);
    const end = filter.parseMonth(filter.endMonth);
    return eachMonthOfInterval({ start, end }).map((d) => format(d, 'yyyy-MM'));
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
          _projected: true
        });
      }
    });

    return { txByMonth };
  }, [transactions, projections, categories, currentMonthEnd]);

  const sumByType = (type: string) => {
    let total = 0;
    allData.txByMonth.forEach((txs) => {
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
      allData.txByMonth.forEach((txs) => {
        txs.forEach((t: any) => {if (childIds.has(t.category_id)) total += Number(t.amount);});
      });
      return { name: parent.name, value: total };
    }).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  }, [categories, allData]);

  const stackedBarData = useMemo(() => {
    if (!categories) return { data: [] as any[], keys: [] as string[] };
    const parentCats = categories.filter((c) => !c.parent_id && c.dre_type === 'despesa');
    const catNames = parentCats.map((c) => c.name);
    const childMap = new Map<string, string>();
    parentCats.forEach((p) => {
      categories.filter((c) => c.parent_id === p.id).forEach((c) => childMap.set(c.id, p.name));
    });

    const data = months.map((m) => {
      const row: any = {
        mes: format(new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1), 'MMM/yy', { locale: ptBR })
      };
      catNames.forEach((n) => row[n] = 0);
      const txs = allData.txByMonth.get(m) || [];
      txs.forEach((t: any) => {
        const pName = childMap.get(t.category_id);
        if (pName) row[pName] = (row[pName] || 0) + Number(t.amount);
      });
      return row;
    });

    return { data, keys: catNames.filter((n) => data.some((d) => d[n] > 0)) };
  }, [categories, months, allData]);

  const lineData = useMemo(() => {
    if (!categories) return [];
    return months.map((m) => {
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
        'Lucro Líquido': ll
      };
    });
  }, [categories, months, allData]);

  const detailedTableData = useMemo(() => {
    const rows: {[key: string]: string | number;}[] = [];
    rows.push({ Indicador: 'Receita Bruta', Valor: formatBRL(receitaBruta) });
    rows.push({ Indicador: '(-) Descontos', Valor: formatBRL(descontos) });
    rows.push({ Indicador: '= Receita Líquida', Valor: formatBRL(receitaLiquida) });
    rows.push({ Indicador: '(-) Custos', Valor: formatBRL(custos) });
    rows.push({ Indicador: '= Lucro Bruto', Valor: formatBRL(lucroBruto) });
    rows.push({ Indicador: '(-) Despesas Operacionais', Valor: formatBRL(despesas) });
    rows.push({ Indicador: '= EBITDA', Valor: formatBRL(ebitda) });
    rows.push({ Indicador: '= LUCRO LÍQUIDO', Valor: formatBRL(lucroLiquido) });
    rows.push({ Indicador: '', Valor: '' });
    rows.push({ Indicador: 'EVOLUÇÃO MENSAL', Valor: '' });
    lineData.forEach((d) => {
      rows.push({
        Indicador: d.mes,
        'Receita Bruta': formatBRL(d['Receita Bruta']),
        'Despesas + Custos': formatBRL(d['Despesas + Custos']),
        'Lucro Líquido': formatBRL(d['Lucro Líquido'])
      });
    });
    if (pieData.length > 0) {
      rows.push({ Indicador: '', Valor: '' });
      rows.push({ Indicador: 'DISTRIBUIÇÃO DE DESPESAS', Valor: '' });
      pieData.forEach((d) => {
        rows.push({ Indicador: d.name, Valor: formatBRL(d.value) });
      });
    }
    return rows;
  }, [receitaBruta, descontos, receitaLiquida, custos, lucroBruto, despesas, ebitda, lucroLiquido, lineData, pieData]);

  const periodLabel = filter.startMonth === filter.endMonth ?
  format(filter.parseMonth(filter.startMonth), "MMMM 'de' yyyy", { locale: ptBR }) :
  `${format(filter.parseMonth(filter.startMonth), 'MMM/yy', { locale: ptBR })} a ${format(filter.parseMonth(filter.endMonth), 'MMM/yy', { locale: ptBR })}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>);

  }

  const kpis = [
  { label: 'Receita Líquida', value: receitaLiquida, icon: DollarSign, glowClass: 'glow-border' },
  { label: 'Despesas', value: despesas, icon: TrendingDown, glowClass: 'glow-border-orange' },
  { label: 'EBITDA', value: ebitda, icon: Wallet, glowClass: 'glow-border-blue' },
  { label: 'Lucro Líquido', value: lucroLiquido, icon: TrendingUp, glowClass: 'glow-border' }];


  const tooltipStyle = {
    contentStyle: {
      background: 'hsl(200 35% 12% / 0.95)',
      border: '1px solid hsl(200 25% 20%)',
      borderRadius: '8px',
      backdropFilter: 'blur(8px)',
      color: '#fff'
    }
  };

  return (
    <div ref={dashboardRef} className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-bold text-orange-500 text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground capitalize">{periodLabel}</p>
        </div>
        <MonthRangePicker
          startMonth={filter.startMonth}
          endMonth={filter.endMonth}
          onStartChange={filter.setStartMonth}
          onEndChange={filter.setEndMonth}
          onYearClick={() => filter.setFullYear()} />
        
        <ExportMenu
          filename={`dashboard-${filter.startMonth}-${filter.endMonth}`}
          title={`Dashboard — ${periodLabel}`}
          getData={() => detailedTableData}
          chartRefs={[pieChartRef, lineChartRef, barChartRef]}
          screenshotRef={dashboardRef} />
        
      </div>

      {/* KPI Cards with glassmorphism */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) =>
        <motion.div
          key={kpi.label}
          custom={i}
          initial="hidden"
          animate="visible"
          variants={cardVariant}>
          
            <Card className={`glass-card float-card ${kpi.glowClass} border-border/30`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium tracking-wide uppercase">{kpi.label}</p>
                    <p className={`text-xl font-display font-bold tabular-nums mt-1 ${kpi.value < 0 ? 'text-destructive' : 'text-foreground'}`}>
                      {formatBRL(kpi.value)}
                    </p>
                  </div>
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'hsl(var(--primary) / 0.1)' }}>
                    <kpi.icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Financial Health Score Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.5 }}>
        <FinancialHealthScoreCard />
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.5 }}>
          <Card className="glass-card float-card border-border/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-display">Distribuição de Despesas (%)</CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => exportChartAsPNG(pieChartRef.current, 'distribuicao-despesas')} title="Exportar gráfico">
                <ImageDown className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {pieData.length === 0 ?
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados para o período</p> :

              <div ref={pieChartRef}>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}
                    stroke="hsl(200 35% 12%)" strokeWidth={2}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatBRL(v)} {...tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              }
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.5 }}>
          <Card className="glass-card float-card border-border/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-display">Evolução DRE Mensal</CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => exportChartAsPNG(lineChartRef.current, 'evolucao-dre-mensal')} title="Exportar gráfico">
                <ImageDown className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {lineData.length === 0 ?
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p> :

              <div ref={lineChartRef} className="chart-glow-green">
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={lineData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 25% 18% / 0.5)" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(207 25% 60%)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(207 25% 60%)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => formatBRL(v)} {...tooltipStyle} />
                      <Legend />
                      <Line type="monotone" dataKey="Receita Bruta" stroke="hsl(160, 78%, 49%)" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="Despesas + Custos" stroke="hsl(0, 72%, 51%)" strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="Lucro Líquido" stroke="hsl(195, 100%, 59%)" strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              }
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Stacked bar */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.5 }}>
        <Card className="glass-card float-card border-border/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-display">Gastos por Categoria (Coluna Empilhada)</CardTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => exportChartAsPNG(barChartRef.current, 'gastos-por-categoria')} title="Exportar gráfico">
              <ImageDown className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {stackedBarData.data.length === 0 ?
            <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p> :

            <div ref={barChartRef}>
                <ResponsiveContainer width="100%" height={380}>
                  <BarChart data={stackedBarData.data} barCategoryGap="35%" barGap={1} maxBarSize={40} margin={{ top: 20, right: 25, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 25% 18% / 0.5)" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(207 25% 60%)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(207 25% 60%)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatBRL(v)} {...tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {stackedBarData.keys.map((key, i) => {
                      const color = COLORS[i % COLORS.length];
                      const { h, s, l } = (() => {
                        const m = color.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%?\s*,\s*([\d.]+)%?\s*\)/);
                        if (!m) return { h: 0, s: 50, l: 50 };
                        return { h: parseFloat(m[1]), s: parseFloat(m[2]), l: parseFloat(m[3]) };
                      })();
                      return (
                        <Bar
                          key={key}
                          dataKey={key}
                          stackId="expenses"
                          fill={color}
                          shape={(props: any) => {
                            const { x, y, width, height } = props;
                            if (!height || height <= 0) return null;
                            const depth = Math.min(width * 0.3, 8);
                            const frontId = `grad-dash-${h}-${s}-${l}-${y}`.replace(/\./g, '_');
                            return (
                              <g>
                                <defs>
                                  <linearGradient id={frontId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={`hsl(${h}, ${s}%, ${Math.min(100, l + 6)}%)`} />
                                    <stop offset="100%" stopColor={`hsl(${h}, ${s}%, ${Math.max(0, l - 6)}%)`} />
                                  </linearGradient>
                                </defs>
                                <rect x={x} y={y} width={width} height={height} fill={`url(#${frontId})`} />
                                <polygon
                                  points={`${x},${y} ${x + depth},${y - depth} ${x + width + depth},${y - depth} ${x + width},${y}`}
                                  fill={`hsl(${h}, ${s}%, ${Math.min(100, l + 18)}%)`}
                                />
                                <polygon
                                  points={`${x + width},${y} ${x + width + depth},${y - depth} ${x + width + depth},${y + height - depth} ${x + width},${y + height}`}
                                  fill={`hsl(${h}, ${s}%, ${Math.max(0, l - 18)}%)`}
                                />
                              </g>
                            );
                          }}
                        >
                          <LabelList
                            dataKey={key}
                            position="inside"
                            style={{ fontSize: 9, fill: '#fff', fontWeight: 500 }}
                            formatter={(v: number) => v > 0 ? `${(v / 1000).toFixed(1)}k` : ''}
                          />
                        </Bar>
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            }
          </CardContent>
        </Card>
      </motion.div>

      {/* Yearly Evolution */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.5 }}>
        <YearlyEvolution />
      </motion.div>
    </div>);

}