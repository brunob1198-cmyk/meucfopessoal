import { useMemo } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { usePersistedFilter } from '@/hooks/usePersistedFilter';
import { MonthRangePicker } from '@/components/MonthRangePicker';
import { formatBRL } from '@/lib/dre';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
  const filter = usePersistedFilter('dashboard');

  const { data: transactions, isLoading: txLoading } = useTransactions(filter.startDate, filter.endDate);
  const { data: categories, isLoading: catLoading } = useCategories();

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

  const barData = useMemo(() => {
    if (!transactions) return [];
    const monthMap = new Map<string, { receita: number; despesa: number }>();
    (transactions as any[]).forEach((t) => {
      const m = t.date.substring(0, 7);
      if (!monthMap.has(m)) monthMap.set(m, { receita: 0, despesa: 0 });
      const entry = monthMap.get(m)!;
      if (t.categories?.dre_type === 'receita') entry.receita += Number(t.amount);
      else if (t.categories?.dre_type === 'despesa') entry.despesa += Number(t.amount);
    });
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, v]) => ({
        mes: format(new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1), 'MMM/yy', { locale: ptBR }),
        Receita: v.receita,
        Despesa: v.despesa,
      }));
  }, [transactions]);

  const startLabel = format(filter.parseMonth(filter.startMonth), "MMM/yy", { locale: ptBR });
  const endLabel = format(filter.parseMonth(filter.endMonth), "MMM/yy", { locale: ptBR });
  const periodLabel = filter.startMonth === filter.endMonth
    ? format(filter.parseMonth(filter.startMonth), "MMMM 'de' yyyy", { locale: ptBR })
    : `${startLabel} a ${endLabel}`;

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
      </div>

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
