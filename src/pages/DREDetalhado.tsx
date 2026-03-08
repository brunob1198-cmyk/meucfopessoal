import { useState, useMemo } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useProjections } from '@/hooks/useProjections';
import { computeDRE, formatBRL, DRELine } from '@/lib/dre';
import { usePersistedFilter } from '@/hooks/usePersistedFilter';
import { MonthRangePicker } from '@/components/MonthRangePicker';
import { format, startOfMonth, endOfMonth, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';

interface DRELineEx extends DRELine {
  categoryId?: string;
  parentId?: string;
  children?: DRELineEx[];
  isParentGroup?: boolean;
  source?: 'real' | 'projetado';
}

function DRERow({ line, depth = 0 }: { line: DRELineEx; depth?: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = line.children && line.children.length > 0;
  const isProjected = line.source === 'projetado';

  return (
    <>
      <tr
        className={`border-b border-border/50 ${
          line.isTotal ? 'bg-muted/40 font-semibold' : ''
        } ${isProjected ? 'bg-primary/5' : ''}`}
      >
        <td
          className="py-2 px-3 flex items-center gap-1"
          style={{ paddingLeft: `${(line.indent + depth) * 1.5 + 0.75}rem` }}
        >
          {hasChildren && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-0.5 hover:bg-muted rounded"
            >
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          )}
          <span>{line.label}</span>
          {isProjected && (
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-normal">
              projetado
            </span>
          )}
        </td>
        <td
          className={`text-right py-2 px-3 tabular-nums ${
            line.value < 0 ? 'text-destructive' : ''
          } ${isProjected ? 'text-primary' : ''}`}
        >
          {formatBRL(line.value)}
        </td>
        <td className="text-right py-2 px-3 tabular-nums text-muted-foreground">
          {line.percent.toFixed(1)}%
        </td>
      </tr>
      {expanded && line.children?.map((child, i) => (
        <DRERow key={i} line={child} depth={depth} />
      ))}
    </>
  );
}

export default function DREDetalhado() {
  const filter = usePersistedFilter('dre-detalhado');

  const { data: transactions, isLoading: txLoading } = useTransactions(filter.startDate, filter.endDate);
  const { data: categories, isLoading: catLoading } = useCategories();
  const { data: projections } = useProjections(filter.startDate, filter.endDate);

  const loading = txLoading || catLoading;

  const now = new Date();
  const currentMonthEnd = endOfMonth(now);

  // Determine if period is all future (use projections), all past (use real), or mixed
  const lines = useMemo(() => {
    if (!categories) return [];

    const startD = filter.parseMonth(filter.startMonth);
    const endD = filter.parseMonth(filter.endMonth);

    // If entire range is in the future, use projections
    const isFuture = isAfter(startD, currentMonthEnd);

    if (isFuture && projections) {
      // Build DRE from projections
      const fakeTx = projections.map((p: any) => ({
        amount: p.amount,
        category_id: p.category_id,
        categories: p.categories,
      }));
      const dreLines = computeDRE(fakeTx, categories);
      return dreLines.map(l => ({ ...l, source: 'projetado' as const }));
    }

    if (!transactions) return [];
    return computeDRE(transactions as any, categories).map(l => ({ ...l, source: 'real' as const }));
  }, [transactions, categories, projections, filter.startMonth, filter.endMonth]);

  const startLabel = format(filter.parseMonth(filter.startMonth), "MMM/yy", { locale: ptBR });
  const endLabel = format(filter.parseMonth(filter.endMonth), "MMM/yy", { locale: ptBR });
  const periodLabel = filter.startMonth === filter.endMonth
    ? format(filter.parseMonth(filter.startMonth), "MMMM 'de' yyyy", { locale: ptBR })
    : `${startLabel} a ${endLabel}`;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">DRE Detalhado</h1>
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
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Descrição</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Valor (R$)</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">%</th>
                  </tr>
                </thead>
                <tbody>
                  {(lines as DRELineEx[]).map((line, i) => (
                    <DRERow key={i} line={line} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
