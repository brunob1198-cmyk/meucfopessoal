import { useState, useMemo } from 'react';
import { parseLocalDate } from '@/lib/utils';
import { useTransactions, useUpdateTransaction, useDeleteTransaction, useCreateTransaction } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useProjections } from '@/hooks/useProjections';
import { computeDRE, formatBRL, DRELine } from '@/lib/dre';
import { usePersistedFilter } from '@/hooks/usePersistedFilter';
import { MonthRangePicker } from '@/components/MonthRangePicker';
import { format, eachMonthOfInterval, startOfMonth, endOfMonth, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown, ChevronRight, Search, ChevronsUpDown, Pencil, Check, X, Trash2, Plus } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { ExportMenu } from '@/components/ExportMenu';

interface MonthData {
  month: string;
  lines: DRELine[];
  isProjected: boolean;
}

export default function DREDetalhado() {
  const filter = usePersistedFilter('dre-detalhado');
  const { data: transactions, isLoading: txLoading } = useTransactions(filter.startDate, filter.endDate);
  const { data: categories, isLoading: catLoading } = useCategories();
  const { data: projections } = useProjections(filter.startDate, filter.endDate);
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const loading = txLoading || catLoading;
  const now = new Date();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editComment, setEditComment] = useState('');
  const currentMonthEnd = endOfMonth(now);

  const months = useMemo(() => {
    const start = filter.parseMonth(filter.startMonth);
    const end = filter.parseMonth(filter.endMonth);
    return eachMonthOfInterval({ start, end }).map(d => format(d, 'yyyy-MM'));
  }, [filter.startMonth, filter.endMonth]);

  const monthsData = useMemo<MonthData[]>(() => {
    if (!categories) return [];
    return months.map(m => {
      const monthDate = filter.parseMonth(m);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const isFuture = isAfter(monthStart, currentMonthEnd);
      const monthTx = (transactions || []).filter((t: any) => {
        const txDate = parseLocalDate(t.date);
        return !isBefore(txDate, monthStart) && !isAfter(txDate, monthEnd);
      });
      if (isFuture) {
        const monthProjections = (projections || []).filter(
          (p: any) => typeof p.month === 'string' && p.month.substring(0, 7) === m
        );
        const projTx = monthProjections.map((p: any) => ({
          amount: p.amount, category_id: p.category_id, categories: p.categories,
        }));
        return { month: m, lines: computeDRE([...projTx, ...monthTx], categories), isProjected: true };
      }
      return { month: m, lines: computeDRE(monthTx as any, categories), isProjected: false };
    });
  }, [transactions, categories, projections, months, currentMonthEnd]);

  const rowLabels = useMemo(() => {
    if (monthsData.length === 0) return [];
    return monthsData[0].lines.map(l => ({
      label: l.label, indent: l.indent, isTotal: l.isTotal, isGroupHeader: l.isGroupHeader,
      isSubcategory: l.isSubcategory, groupId: l.groupId, parentGroupId: l.parentGroupId,
      categoryId: l.categoryId, type: l.type,
    }));
  }, [monthsData]);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  const allGroupIds = useMemo(() => rowLabels.filter(r => r.isGroupHeader && r.groupId).map(r => r.groupId!), [rowLabels]);

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedGroups(new Set());
    } else {
      setExpandedGroups(new Set(allGroupIds));
    }
    setAllExpanded(!allExpanded);
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  };

  const [auditCategory, setAuditCategory] = useState<{ id: string; name: string; month?: string } | null>(null);

  const auditTransactions = useMemo(() => {
    if (!auditCategory || !transactions) return [];
    let filtered = (transactions as any[]).filter(t => t.category_id === auditCategory.id);
    if (auditCategory.month) {
      const ms = startOfMonth(new Date(Number(auditCategory.month.split('-')[0]), Number(auditCategory.month.split('-')[1]) - 1, 1));
      const me = endOfMonth(ms);
      filtered = filtered.filter(t => {
        const d = parseLocalDate(t.date);
        return !isBefore(d, ms) && !isAfter(d, me);
      });
    }
    return filtered.sort((a, b) => a.date.localeCompare(b.date));
  }, [auditCategory, transactions]);

  const periodLabel = filter.startMonth === filter.endMonth
    ? format(filter.parseMonth(filter.startMonth), "MMMM 'de' yyyy", { locale: ptBR })
    : `${format(filter.parseMonth(filter.startMonth), 'MMM/yy', { locale: ptBR })} a ${format(filter.parseMonth(filter.endMonth), 'MMM/yy', { locale: ptBR })}`;

  const getRowStyle = (row: typeof rowLabels[0]) => {
    if (row.isTotal) return 'bg-[hsl(var(--table-total-bg))] text-[hsl(var(--table-total-fg))] font-bold';
    if (row.isGroupHeader) return 'bg-[hsl(var(--table-cat-bg))] text-[hsl(var(--table-cat-fg))] font-semibold';
    if (row.isSubcategory) return 'bg-[hsl(var(--table-subcat-bg))] text-[hsl(var(--table-subcat-fg))]';
    return '';
  };

  return (
    <div className="max-w-full mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">DRE Detalhado</h1>
          <p className="text-sm text-muted-foreground capitalize">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleAll} className="gap-1.5">
            <ChevronsUpDown className="h-4 w-4" />
            {allExpanded ? 'Recolher Tudo' : 'Expandir Tudo'}
          </Button>
          <MonthRangePicker
            startMonth={filter.startMonth} endMonth={filter.endMonth}
            onStartChange={filter.setStartMonth} onEndChange={filter.setEndMonth}
            onYearClick={() => filter.setFullYear()}
          />
          <ExportMenu
            filename={`dre-detalhado-${filter.startMonth}-${filter.endMonth}`}
            title={`DRE Detalhado — ${periodLabel}`}
            getData={() => {
              const rows: { [key: string]: string | number }[] = [];
              rowLabels.forEach((row, idx) => {
                if (row.isSubcategory && row.parentGroupId && !expandedGroups.has(row.parentGroupId)) return;
                const r: any = { Descrição: row.label };
                monthsData.forEach(md => {
                  const line = md.lines[idx];
                  const val = line?.value ?? 0;
                  const label = format(filter.parseMonth(md.month), 'MMM/yy', { locale: ptBR });
                  r[label] = row.type === 'margem' ? `${val.toFixed(1)}%` : formatBRL(val);
                });
                rows.push(r);
              });
              return rows;
            }}
          />
        </div>
      </div>

      <div className="flex gap-3 mb-3 text-xs">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-foreground/10 border border-border" /> Real</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-200 border border-emerald-300" /> Projetado</span>
        <span className="flex items-center gap-1 ml-2 text-muted-foreground">
          Clique nas categorias para expandir. Clique em <Search className="h-3 w-3 inline" /> para ver lançamentos.
        </span>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[hsl(var(--table-total-bg))] text-[hsl(var(--table-total-fg))]">
                    <th className="text-left py-2.5 px-3 font-semibold min-w-[220px] sticky left-0 bg-[hsl(var(--table-total-bg))] z-20">Descrição</th>
                    {monthsData.map(md => (
                      <th key={md.month} className={cn('text-right py-2.5 px-3 font-semibold min-w-[110px] capitalize', md.isProjected && 'text-sky-300')}>
                        {format(filter.parseMonth(md.month), 'MMM/yy', { locale: ptBR })}
                        {md.isProjected && <span className="block text-[9px] font-normal opacity-70">projetado</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rowLabels.map((row, rowIdx) => {
                    if (row.isSubcategory && row.parentGroupId && !expandedGroups.has(row.parentGroupId)) return null;
                    const rowStyle = getRowStyle(row);
                    return (
                      <tr key={rowIdx} className={cn('border-b border-border/30', rowStyle)}>
                        <td className={cn('py-2 px-3 sticky left-0 z-10', rowStyle)} style={{ paddingLeft: `${row.indent * 1.5 + 0.75}rem` }}>
                          <div className="flex items-center gap-1">
                            {row.isGroupHeader && row.groupId && (
                              <button onClick={() => toggleGroup(row.groupId!)} className="p-0.5 hover:opacity-70 rounded">
                                {expandedGroups.has(row.groupId) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                              </button>
                            )}
                            <span>{row.label}</span>
                            {row.isSubcategory && row.categoryId && (
                              <button onClick={() => setAuditCategory({ id: row.categoryId!, name: row.label })} className="p-0.5 hover:bg-muted/50 rounded ml-1 opacity-50 hover:opacity-100" title="Ver todos os lançamentos">
                                <Search className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </td>
                        {monthsData.map(md => {
                          const line = md.lines[rowIdx];
                          const val = line?.value ?? 0;
                          const isMargem = row.type === 'margem';
                          return (
                            <td key={md.month} className={cn('text-right py-2 px-3 tabular-nums relative group/cell', md.isProjected && !row.isTotal && !row.isGroupHeader && 'text-emerald-600')}>
                              {line ? (isMargem ? `${val.toFixed(1)}%` : formatBRL(val)) : '-'}
                              {row.isSubcategory && row.categoryId && val !== 0 && (
                                <button
                                  onClick={() => setAuditCategory({ id: row.categoryId!, name: row.label, month: md.month })}
                                  className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted opacity-0 group-hover/cell:opacity-100 transition-opacity"
                                  title={`Ver lançamentos de ${format(filter.parseMonth(md.month), 'MMM/yy', { locale: ptBR })}`}
                                >
                                  <Search className="h-3 w-3 text-muted-foreground" />
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!auditCategory} onOpenChange={() => setAuditCategory(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Lançamentos: {auditCategory?.name}
              {auditCategory?.month && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({format(filter.parseMonth(auditCategory.month), 'MMMM/yyyy', { locale: ptBR })})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {auditCategory?.month && (
            <Button variant="ghost" size="sm" className="text-xs w-fit" onClick={() => setAuditCategory(prev => prev ? { ...prev, month: undefined } : null)}>
              Ver todos os meses
            </Button>
          )}
          <div className="space-y-1 max-h-[400px] overflow-y-auto">
            {auditTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum lançamento encontrado.</p>
            ) : (
              <>
                <div className="grid grid-cols-[80px_1fr_100px_40px] gap-2 text-xs font-medium text-muted-foreground pb-1 border-b border-border">
                  <span>Data</span><span>Comentário</span><span className="text-right">Valor</span><span></span>
                </div>
                {auditTransactions.map((t: any) => (
                  <div key={t.id} className="group/row grid grid-cols-[80px_1fr_100px_40px] gap-2 text-sm py-1.5 border-b border-border/50 items-center">
                    <span className="text-muted-foreground tabular-nums">{format(parseLocalDate(t.date), 'dd/MM/yy')}</span>
                    <span className="text-muted-foreground flex items-center gap-1 min-w-0">
                      {editingId === t.id ? (
                        <span className="flex items-center gap-1 flex-1">
                          <Input
                            value={editComment}
                            onChange={(e) => setEditComment(e.target.value)}
                            className="h-7 text-xs"
                            placeholder="Comentário..."
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                updateTransaction.mutate({ id: t.id, updates: { comment: editComment || null } });
                                setEditingId(null);
                              }
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                          />
                          <button onClick={() => { updateTransaction.mutate({ id: t.id, updates: { comment: editComment || null } }); setEditingId(null); }} className="p-0.5 hover:bg-muted rounded text-primary"><Check className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setEditingId(null)} className="p-0.5 hover:bg-muted rounded text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
                        </span>
                      ) : (
                        <>
                          <span className="truncate flex-1">{t.comment || '—'}</span>
                          {t.is_installment && <span className="text-[10px] px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{t.installment_number}/{t.total_installments}</span>}
                          <button onClick={() => { setEditingId(t.id); setEditComment(t.comment || ''); }} className="p-0.5 hover:bg-muted rounded opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0" title="Editar comentário"><Pencil className="h-3 w-3 text-muted-foreground" /></button>
                        </>
                      )}
                    </span>
                    <span className={cn('text-right tabular-nums font-medium', Number(t.amount) < 0 && 'text-destructive')}>{formatBRL(Number(t.amount))}</span>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="p-0.5 hover:bg-destructive/10 rounded opacity-0 group-hover/row:opacity-100 transition-opacity" title="Excluir lançamento">
                          <Trash2 className="h-3.5 w-3.5 text-destructive/70 hover:text-destructive" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir este lançamento de {formatBRL(Number(t.amount))} em {format(parseLocalDate(t.date), 'dd/MM/yyyy')}?
                            {t.comment && ` (${t.comment})`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteTransaction.mutate(t.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
                <div className="grid grid-cols-[80px_1fr_100px_40px] gap-2 text-sm py-2 font-semibold border-t border-border">
                  <span /><span>Total</span>
                  <span className="text-right tabular-nums">{formatBRL(auditTransactions.reduce((sum: number, t: any) => sum + Number(t.amount), 0))}</span>
                  <span />
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
