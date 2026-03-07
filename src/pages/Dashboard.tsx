import { useState, useMemo } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { formatBRL } from '@/lib/dre';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const COLORS = [
  'hsl(220, 70%, 45%)',
  'hsl(152, 60%, 40%)',
  'hsl(0, 72%, 51%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 60%, 50%)',
  'hsl(180, 60%, 40%)',
  'hsl(330, 60%, 50%)',
  'hsl(60, 70%, 45%)',
];

export default function Dashboard() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const start = format(startOfMonth(new Date(month + '-01')), 'yyyy-MM-dd');
  const end = format(endOfMonth(new Date(month + '-01')), 'yyyy-MM-dd');

  const { data: transactions, isLoading: txLoading } = useTransactions(start, end);
  const { data: categories, isLoading: catLoading } = useCategories();

  // For monthly evolution, get last 6 months
  const sixMonthsAgo = format(startOfMonth(subMonths(new Date(month + '-01'), 5)), 'yyyy-MM-dd');
  const { data: allTransactions } = useTransactions(sixMonthsAgo, end);

  const loading = txLoading || catLoading;

  const sumByType = (type: string) =>
    (transactions || [])
      .filter((t: any) => t.categories?.dre_type === type)
      .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const receitaBruta = sumByType('receita');
  const descontos = sumByType('desconto');
  const despesas = sumByType('despesa');
  const custos = sumByType('custo');
  const receitaLiquida = receitaBruta - descontos;
  const lucroBruto = receitaLiquida - custos;
  const ebitda = lucroBruto - despesas;
  const lucroLiquido = ebitda - sumByType('depreciacao') + sumByType('resultado_financeiro') + sumByType('outras_receitas') - sumByType('impostos');

  // Pie chart data - expenses by parent category
  const pieData = useMemo(() => {
    if (!transactions || !categories) return [];
    const parentCats = categories.filter((c) => !c.parent_id && c.dre_type === 'despesa');
    return parentCats
      .map((parent) => {
        const children = categories.filter((c) => c.parent_id === parent.id);
        const childIds = new Set(children.map((c) => c.id));
        const total = (transactions as any[])
          .filter((t) => childIds.has(t.category_id))
          .reduce((sum, t) => sum + Number(t.amount), 0);
        return { name: parent.name, value: total };
      })
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [transactions, categories]);

  // Bar chart data - monthly evolution
  const barData = useMemo(() => {
    if (!allTransactions) return [];
    const monthMap = new Map<string, { receita: number; despesa: number }>();
    (allTransactions as any[]).forEach((t) => {
      const m = t.date.substring(0, 7);
      if (!monthMap.has(m)) monthMap.set(m, { receita: 0, despesa: 0 });
      const entry = monthMap.get(m)!;
      if (t.categories?.dre_type === 'receita') entry.receita += Number(t.amount);
      else if (t.categories?.dre_type === 'despesa') entry.despesa += Number(t.amount);
    });
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, v]) => ({
        mes: format(new Date(m + '-01'), 'MMM', { locale: ptBR }),
        Receita: v.receita,
        Despesa: v.despesa,
      }));
  }, [allTransactions]);

  const monthLabel = format(new Date(month + '-01'), "MMMM 'de' yyyy", { locale: ptBR });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground capitalize">{monthLabel}</p>
        </div>
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-44"
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Receita Líquida</p>
                <p className="text-lg font-bold tabular-nums">{formatBRL(receitaLiquida)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-[hsl(var(--chart-receita))] opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Despesas</p>
                <p className="text-lg font-bold tabular-nums">{formatBRL(despesas)}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-destructive opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">EBITDA</p>
                <p className={`text-lg font-bold tabular-nums ${ebitda < 0 ? 'text-destructive' : ''}`}>
                  {formatBRL(ebitda)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-primary opacity-60" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Lucro Líquido</p>
                <p className={`text-lg font-bold tabular-nums ${lucroLiquido < 0 ? 'text-destructive' : ''}`}>
                  {formatBRL(lucroLiquido)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-[hsl(var(--chart-receita))] opacity-60" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição de Despesas</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados para o período</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados para o período</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend />
                  <Bar dataKey="Receita" fill="hsl(152, 60%, 40%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Despesa" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
