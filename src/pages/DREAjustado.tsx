import { useMemo } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useProjections } from '@/hooks/useProjections';
import { computeDREAjustado, formatBRL, DRELine } from '@/lib/dre';
import { usePersistedFilter } from '@/hooks/usePersistedFilter';
import { MonthRangePicker } from '@/components/MonthRangePicker';
import { format, endOfMonth, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function DREAjustado() {
  const filter = usePersistedFilter('dre-ajustado');

  const { data: transactions, isLoading: txLoading } = useTransactions(filter.startDate, filter.endDate);
  const { data: categories, isLoading: catLoading } = useCategories();
  const { data: projections } = useProjections(filter.startDate, filter.endDate);

  const loading = txLoading || catLoading;

  const now = new Date();
  const currentMonthEnd = endOfMonth(now);

  const { lines, isProjected } = useMemo(() => {
    if (!categories) return { lines: [], isProjected: false };
    const startD = filter.parseMonth(filter.startMonth);
    const isFuture = isAfter(startD, currentMonthEnd);

    if (isFuture && projections) {
      const fakeTx = projections.map((p: any) => ({
        amount: p.amount,
        category_id: p.category_id,
        categories: p.categories,
      }));
      return { lines: computeDREAjustado(fakeTx, categories), isProjected: true };
    }

    if (!transactions) return { lines: [], isProjected: false };
    return { lines: computeDREAjustado(transactions as any, categories), isProjected: false };
  }, [transactions, categories, projections, filter.startMonth, filter.endMonth]);

  const startLabel = format(filter.parseMonth(filter.startMonth), "MMM/yy", { locale: ptBR });
  const endLabel = format(filter.parseMonth(filter.endMonth), "MMM/yy", { locale: ptBR });
  const periodLabel = filter.startMonth === filter.endMonth
    ? format(filter.parseMonth(filter.startMonth), "MMMM 'de' yyyy", { locale: ptBR })
    : `${startLabel} a ${endLabel}`;

  return (
    <div className="max-w-3xl mx-auto">
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

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                {lines.map((line, i) => (
                  <tr
                    key={i}
                    className={`border-b border-border/50 ${
                      line.isTotal ? 'bg-muted/40 font-semibold' : ''
                    } ${isProjected ? 'bg-primary/5' : ''}`}
                  >
                    <td className="py-3 px-4">
                      {line.label}
                      {isProjected && i === 0 && (
                        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                          projetado
                        </span>
                      )}
                    </td>
                    <td className={`text-right py-3 px-4 tabular-nums ${line.value < 0 ? 'text-destructive' : ''} ${isProjected ? 'text-primary' : ''}`}>
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
