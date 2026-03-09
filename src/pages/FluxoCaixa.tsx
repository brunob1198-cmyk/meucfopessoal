import { useState, useMemo } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MonthRangePicker } from '@/components/MonthRangePicker';
import { format, startOfMonth, endOfMonth, addMonths, subMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatBRL } from '@/lib/dre';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp, TrendingDown, AlertTriangle, Info } from 'lucide-react';
import { computeDRE } from '@/lib/dre';

export default function FluxoCaixa() {
  const now = new Date();
  const [startDate, setStartDate] = useState(format(subMonths(startOfMonth(now), 5), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(addMonths(now, 6)), 'yyyy-MM-dd'));

  const { data: transactions = [] } = useTransactions(startDate, endDate);
  const { data: categories = [] } = useCategories();

  // Group transactions by payment_date month for cash flow
  const monthlyData = useMemo(() => {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    const months: string[] = [];
    let cursor = startOfMonth(start);
    while (cursor <= end) {
      months.push(format(cursor, 'yyyy-MM'));
      cursor = addMonths(cursor, 1);
    }

    let accumulatedBalance = 0;

    return months.map((m) => {
      const monthTxs = transactions.filter((t: any) => {
        const payDate = (t as any).payment_date || t.date;
        return payDate?.startsWith(m);
      });

      const entradas = monthTxs
        .filter((t: any) => {
          const type = t.categories?.dre_type;
          return type === 'receita' || type === 'outras_receitas';
        })
        .reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0);

      const saidas = monthTxs
        .filter((t: any) => {
          const type = t.categories?.dre_type;
          return type !== 'receita' && type !== 'outras_receitas';
        })
        .reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0);

      const saldo = entradas - saidas;
      accumulatedBalance += saldo;

      return {
        month: m,
        label: format(parseISO(m + '-01'), 'MMM/yy', { locale: ptBR }),
        entradas,
        saidas,
        saldo,
        saldoAcumulado: accumulatedBalance,
        isFuture: m > format(now, 'yyyy-MM'),
      };
    });
  }, [transactions, startDate, endDate]);

  // DRE comparison - current period
  const dreData = useMemo(() => {
    const competenceTxs = transactions.filter((t: any) => {
      const d = t.date;
      return d >= startDate && d <= endDate;
    });
    const dre = computeDRE(competenceTxs as any, categories as any);
    const lucroLine = dre.find(l => l.label.includes('LUCRO LÍQUIDO') && l.isTotal);
    return lucroLine?.value || 0;
  }, [transactions, categories, startDate, endDate]);

  const totalEntradas = monthlyData.reduce((s, m) => s + m.entradas, 0);
  const totalSaidas = monthlyData.reduce((s, m) => s + m.saidas, 0);
  const totalCaixa = totalEntradas - totalSaidas;

  // Insights
  const insights = useMemo(() => {
    const msgs: { text: string; type: 'warning' | 'info' | 'success' }[] = [];
    
    if (dreData > totalCaixa + 100) {
      msgs.push({
        text: `Seu lucro (${formatBRL(dreData)}) é maior que sua geração de caixa (${formatBRL(totalCaixa)}). Isso indica despesas parceladas comprometendo caixa futuro.`,
        type: 'warning',
      });
    } else if (totalCaixa > dreData + 100) {
      msgs.push({
        text: `Sua geração de caixa (${formatBRL(totalCaixa)}) é maior que o lucro contábil (${formatBRL(dreData)}). Há recebimentos antecipados ou ajustes não reconhecidos.`,
        type: 'info',
      });
    }

    const futureMonths = monthlyData.filter(m => m.isFuture);
    const negativeMonths = futureMonths.filter(m => m.saldo < 0);
    if (negativeMonths.length > 0) {
      msgs.push({
        text: `Atenção: ${negativeMonths.length} mês(es) futuro(s) com fluxo de caixa negativo.`,
        type: 'warning',
      });
    }

    const installmentTxs = transactions.filter((t: any) => t.is_installment);
    if (installmentTxs.length > 0) {
      const totalInstallmentValue = installmentTxs.reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0);
      msgs.push({
        text: `Você possui ${formatBRL(totalInstallmentValue)} em parcelas registradas no período.`,
        type: 'info',
      });
    }

    if (totalCaixa > 0) {
      msgs.push({ text: 'Sua geração de caixa no período é positiva. Bom trabalho!', type: 'success' });
    }

    return msgs;
  }, [dreData, totalCaixa, monthlyData, transactions]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fluxo de Caixa</h1>
          <p className="text-sm text-muted-foreground">Visão de liquidez — quando o dinheiro entra e sai</p>
        </div>
        <MonthRangePicker
          startMonth={startDate}
          endMonth={endDate}
          onStartChange={setStartDate}
          onEndChange={setEndDate}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-[hsl(var(--success))]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <ArrowUpCircle className="h-4 w-4 text-[hsl(var(--success))]" />
              Entradas de Caixa
            </div>
            <p className="text-2xl font-bold text-[hsl(var(--success))]">{formatBRL(totalEntradas)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[hsl(var(--destructive))]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <ArrowDownCircle className="h-4 w-4 text-destructive" />
              Saídas de Caixa
            </div>
            <p className="text-2xl font-bold text-destructive">{formatBRL(totalSaidas)}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Wallet className="h-4 w-4 text-primary" />
              Saldo do Período
            </div>
            <p className={`text-2xl font-bold ${totalCaixa >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
              {formatBRL(totalCaixa)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fluxo de Caixa Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" className="text-xs" />
              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
              <Tooltip
                formatter={(value: number, name: string) => [formatBRL(value), name]}
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Bar dataKey="entradas" name="Entradas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saidas" name="Saídas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* DRE vs Cash comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Competência vs Caixa</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Lucro Líquido (DRE — Competência)
              </div>
              <p className={`text-3xl font-bold ${dreData >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                {formatBRL(dreData)}
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wallet className="h-4 w-4" />
                Geração de Caixa (Pagamentos)
              </div>
              <p className={`text-3xl font-bold ${totalCaixa >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                {formatBRL(totalCaixa)}
              </p>
            </div>
          </div>
          {Math.abs(dreData - totalCaixa) > 1 && (
            <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm text-muted-foreground">
                <strong>Diferença:</strong> {formatBRL(Math.abs(dreData - totalCaixa))} —{' '}
                {dreData > totalCaixa
                  ? 'Lucro contábil maior que caixa gerado. Indica despesas reconhecidas com pagamento futuro (parcelas, provisões).'
                  : 'Caixa gerado maior que o lucro contábil. Indica recebimentos antecipados ou ajustes de período.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly detail table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalhamento Mensal</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Mês</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Entradas</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Saídas</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Saldo</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.map((m) => (
                <tr key={m.month} className={`border-b border-border/50 ${m.isFuture ? 'opacity-70 bg-muted/30' : ''}`}>
                  <td className="py-2 px-3 font-medium capitalize">
                    {m.label}
                    {m.isFuture && <span className="ml-1 text-xs text-muted-foreground">(projetado)</span>}
                  </td>
                  <td className="text-right py-2 px-3 text-[hsl(var(--success))]">{formatBRL(m.entradas)}</td>
                  <td className="text-right py-2 px-3 text-destructive">{formatBRL(m.saidas)}</td>
                  <td className={`text-right py-2 px-3 font-medium ${m.saldo >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                    {formatBRL(m.saldo)}
                  </td>
                  <td className={`text-right py-2 px-3 font-medium ${m.saldoAcumulado >= 0 ? 'text-[hsl(var(--success))]' : 'text-destructive'}`}>
                    {formatBRL(m.saldoAcumulado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Insights Financeiros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.map((insight, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  insight.type === 'warning'
                    ? 'bg-[hsl(var(--warning)/0.1)] border-[hsl(var(--warning)/0.3)]'
                    : insight.type === 'success'
                    ? 'bg-[hsl(var(--success)/0.1)] border-[hsl(var(--success)/0.3)]'
                    : 'bg-muted/50 border-border'
                }`}
              >
                {insight.type === 'warning' ? (
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-[hsl(var(--warning))] shrink-0" />
                ) : insight.type === 'success' ? (
                  <TrendingUp className="h-4 w-4 mt-0.5 text-[hsl(var(--success))] shrink-0" />
                ) : (
                  <Info className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                )}
                <p className="text-sm text-foreground">{insight.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
