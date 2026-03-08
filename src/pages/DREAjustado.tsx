import { useMemo } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useProjections } from '@/hooks/useProjections';
import { computeDREAjustado, formatBRL, DRELine } from '@/lib/dre';
import { usePersistedFilter } from '@/hooks/usePersistedFilter';
import { MonthRangePicker } from '@/components/MonthRangePicker';
import { format, eachMonthOfInterval, startOfMonth, endOfMonth, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonthData {
  month: string;
  lines: DRELine[];
  isProjected: boolean;
}

export default function DREAjustado() {
  const filter = usePersistedFilter('dre-ajustado');

  const { data: transactions, isLoading: txLoading } = useTransactions(filter.startDate, filter.endDate);
  const { data: categories, isLoading: catLoading } = useCategories();
  const { data: projections } = useProjections(filter.startDate, filter.endDate);

  const loading = txLoading || catLoading;

  const now = new Date();
  const currentMonthEnd = endOfMonth(now);

  // Generate list of months in the selected range
  const months = useMemo(() => {
    const start = filter.parseMonth(filter.startMonth);
    const end = filter.parseMonth(filter.endMonth);
    return eachMonthOfInterval({ start, end }).map(d => format(d, 'yyyy-MM'));
  }, [filter.startMonth, filter.endMonth]);

  // Compute DRE per month
  const monthsData = useMemo<MonthData[]>(() => {
    if (!categories) return [];

    return months.map(m => {
      const monthDate = filter.parseMonth(m);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const isFuture = isAfter(monthStart, currentMonthEnd);

      if (isFuture && projections) {
        const monthProjections = projections.filter((p: any) => p.month === m);
        const fakeTx = monthProjections.map((p: any) => ({
          amount: p.amount,
          category_id: p.category_id,
          categories: p.categories,
        }));
        return {
          month: m,
          lines: computeDREAjustado(fakeTx, categories),
          isProjected: true,
        };
      }

      const monthTx = (transactions || []).filter((t: any) => {
        const txDate = new Date(t.date);
        return !isBefore(txDate, monthStart) && !isAfter(txDate, monthEnd);
      });

      return {
        month: m,
        lines: computeDREAjustado(monthTx as any, categories),
        isProjected: false,
      };
    });
  }, [transactions, categories, projections, months, currentMonthEnd]);

  // Get unified row labels from first month
  const rowLabels = useMemo(() => {
    if (monthsData.length === 0) return [];
    return monthsData[0].lines.map(l => ({
      label: l.label,
      isTotal: l.isTotal,
    }));
  }, [monthsData]);

  const periodLabel = filter.startMonth === filter.endMonth
    ? format(filter.parseMonth(filter.startMonth), "MMMM 'de' yyyy", { locale: ptBR })
    : `${format(filter.parseMonth(filter.startMonth), 'MMM/yy', { locale: ptBR })} a ${format(filter.parseMonth(filter.endMonth), 'MMM/yy', { locale: ptBR })}`;

  const showMultipleMonths = months.length > 1;

  return (
    <div className="max-w-full mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">DRE Ajustado</h1>
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

      <div className="flex gap-3 mb-3 text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-foreground/10 border border-border" /> Real
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-primary/20 border border-primary/30" /> Projetado
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : showMultipleMonths ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[180px] sticky left-0 bg-card">
                      Descrição
                    </th>
                    {monthsData.map(md => (
                      <th
                        key={md.month}
                        className={cn(
                          'text-right py-3 px-3 font-medium min-w-[100px] capitalize',
                          md.isProjected ? 'text-primary bg-primary/5' : 'text-muted-foreground'
                        )}
                      >
                        {format(filter.parseMonth(md.month), 'MMM/yy', { locale: ptBR })}
                        {md.isProjected && (
                          <span className="block text-[9px] font-normal opacity-70">projetado</span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowLabels.map((row, rowIdx) => (
                    <tr
                      key={rowIdx}
                      className={cn(
                        'border-b border-border/50',
                        row.isTotal && 'bg-muted/40 font-semibold'
                      )}
                    >
                      <td className="py-3 px-4 sticky left-0 bg-card">
                        {row.label}
                      </td>
                      {monthsData.map(md => {
                        const line = md.lines[rowIdx];
                        return (
                          <td
                            key={md.month}
                            className={cn(
                              'text-right py-3 px-3 tabular-nums',
                              line?.value < 0 && 'text-destructive',
                              md.isProjected && 'text-primary bg-primary/5'
                            )}
                          >
                            {line ? formatBRL(line.value) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Descrição</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Valor (R$)</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">%</th>
                </tr>
              </thead>
              <tbody>
                {(monthsData[0]?.lines || []).map((line, i) => (
                  <tr
                    key={i}
                    className={cn(
                      'border-b border-border/50',
                      line.isTotal && 'bg-muted/40 font-semibold',
                      monthsData[0]?.isProjected && 'bg-primary/5'
                    )}
                  >
                    <td className="py-3 px-4">
                      {line.label}
                      {monthsData[0]?.isProjected && i === 0 && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          projetado
                        </span>
                      )}
                    </td>
                    <td className={cn(
                      'text-right py-3 px-4 tabular-nums',
                      line.value < 0 && 'text-destructive',
                      monthsData[0]?.isProjected && 'text-primary'
                    )}>
                      {formatBRL(line.value)}
                    </td>
                    <td className="text-right py-3 px-4 tabular-nums text-muted-foreground">
                      {line.percent.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
