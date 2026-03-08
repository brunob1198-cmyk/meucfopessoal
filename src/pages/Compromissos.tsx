import { useMemo } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useProjections } from '@/hooks/useProjections';
import { formatBRL } from '@/lib/dre';
import { format, addMonths, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CalendarRange, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Compromissos() {
  const now = new Date();
  const startDate = format(startOfMonth(now), 'yyyy-MM-dd');
  const futureEnd = addMonths(now, 11);
  const endDate = format(endOfMonth(futureEnd), 'yyyy-MM-dd');

  const { data: transactions, isLoading: txLoading } = useTransactions(startDate, endDate);
  const { data: categories, isLoading: catLoading } = useCategories();
  const { data: projections, isLoading: projLoading } = useProjections(startDate, endDate);
  const loading = txLoading || catLoading || projLoading;

  const months = useMemo(() => {
    return eachMonthOfInterval({ start: startOfMonth(now), end: endOfMonth(futureEnd) }).map(d => format(d, 'yyyy-MM'));
  }, []);

  const currentMonth = format(now, 'yyyy-MM');

  const monthData = useMemo(() => {
    if (!categories) return [];

    const catMap = new Map<string, any>();
    categories.forEach(c => catMap.set(c.id, c));

    return months.map(m => {
      const ms = startOfMonth(new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1));
      const me = endOfMonth(ms);
      const isFuture = m > currentMonth;
      const isCurrent = m === currentMonth;

      // Real transactions for this month
      const monthTx = (transactions || []).filter((t: any) => {
        const d = t.date.substring(0, 7);
        return d === m;
      });

      // Projections for this month
      const monthProj = (projections || []).filter((p: any) =>
        typeof p.month === 'string' && p.month.substring(0, 7) === m
      );

      // Calculate totals by type
      const sumByType = (source: any[], type: string) => {
        return source.reduce((sum, item) => {
          const cat = catMap.get(item.category_id);
          if (cat?.dre_type === type || item.categories?.dre_type === type) {
            return sum + Number(item.amount);
          }
          return sum;
        }, 0);
      };

      let receita = 0, despesas = 0, custos = 0, descontos = 0, investimentos = 0;

      if (isFuture) {
        // Use projections + installments
        receita = sumByType(monthProj, 'receita');
        despesas = sumByType(monthProj, 'despesa');
        custos = sumByType(monthProj, 'custo');
        descontos = sumByType(monthProj, 'desconto');
        investimentos = sumByType(monthProj, 'investimento');
        // Add installments from real transactions
        const installments = monthTx.filter((t: any) => t.is_installment);
        installments.forEach((t: any) => {
          const cat = catMap.get(t.category_id);
          if (cat) {
            if (cat.dre_type === 'despesa') despesas += Number(t.amount);
            else if (cat.dre_type === 'custo') custos += Number(t.amount);
          }
        });
      } else {
        // Use real transactions
        receita = sumByType(monthTx, 'receita');
        despesas = sumByType(monthTx, 'despesa');
        custos = sumByType(monthTx, 'custo');
        descontos = sumByType(monthTx, 'desconto');
        investimentos = sumByType(monthTx, 'investimento');
      }

      const compromissos = despesas + custos + descontos + investimentos;
      const sobra = receita - compromissos;

      // Installment details
      const installments = monthTx.filter((t: any) => t.is_installment).map((t: any) => ({
        name: catMap.get(t.category_id)?.name || 'Parcela',
        amount: Number(t.amount),
        number: t.installment_number,
        total: t.total_installments,
        comment: t.comment,
      }));

      // Top expenses
      const expenseByParent = new Map<string, number>();
      const source = isFuture ? monthProj : monthTx;
      source.forEach((item: any) => {
        const cat = catMap.get(item.category_id);
        if (cat && (cat.dre_type === 'despesa' || cat.dre_type === 'custo')) {
          const parentCat = cat.parent_id ? catMap.get(cat.parent_id) : cat;
          const name = parentCat?.name || cat.name;
          expenseByParent.set(name, (expenseByParent.get(name) || 0) + Number(item.amount));
        }
      });
      const topExpenses = [...expenseByParent.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, amount]) => ({ name, amount }));

      return {
        month: m,
        label: format(ms, "MMMM 'de' yyyy", { locale: ptBR }),
        shortLabel: format(ms, 'MMM/yy', { locale: ptBR }),
        receita,
        compromissos,
        sobra,
        isFuture,
        isCurrent,
        installments,
        topExpenses,
      };
    });
  }, [transactions, categories, projections, months, currentMonth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <CalendarRange className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Mapa de Compromissos Financeiros</h1>
          <p className="text-sm text-muted-foreground">Visão dos próximos 12 meses com parcelas, despesas e receitas</p>
        </div>
      </div>

      {/* Timeline cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {monthData.map(md => (
          <Card key={md.month} className={cn(
            'transition-all',
            md.isCurrent && 'ring-2 ring-primary shadow-lg',
            md.isFuture && 'opacity-90',
            md.sobra < 0 && 'border-destructive/40',
          )}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold capitalize flex items-center justify-between">
                <span>{md.label}</span>
                {md.isCurrent && <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Atual</span>}
                {md.isFuture && <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Projetado</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Receita</p>
                  <p className="text-sm font-bold text-primary tabular-nums">{formatBRL(md.receita)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Compromissos</p>
                  <p className="text-sm font-bold text-destructive tabular-nums">{formatBRL(md.compromissos)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Sobra</p>
                  <p className={cn('text-sm font-bold tabular-nums', md.sobra >= 0 ? 'text-primary' : 'text-destructive')}>
                    {formatBRL(md.sobra)}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', md.sobra >= 0 ? 'bg-primary' : 'bg-destructive')}
                  style={{ width: `${md.receita > 0 ? Math.min((md.compromissos / md.receita) * 100, 100) : 0}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-right">
                {md.receita > 0 ? `${((md.compromissos / md.receita) * 100).toFixed(0)}% comprometido` : 'Sem receita'}
              </p>

              {/* Installments */}
              {md.installments.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Parcelas</p>
                  <div className="space-y-1">
                    {md.installments.slice(0, 3).map((inst, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="truncate mr-2">{inst.name} <span className="text-muted-foreground">{inst.number}/{inst.total}</span></span>
                        <span className="tabular-nums font-medium">{formatBRL(inst.amount)}</span>
                      </div>
                    ))}
                    {md.installments.length > 3 && (
                      <p className="text-[10px] text-muted-foreground">+{md.installments.length - 3} parcela(s)</p>
                    )}
                  </div>
                </div>
              )}

              {/* Top expenses */}
              {md.topExpenses.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Maiores Gastos</p>
                  <div className="space-y-1">
                    {md.topExpenses.map((exp, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="truncate mr-2">{exp.name}</span>
                        <span className="tabular-nums font-medium">{formatBRL(exp.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
