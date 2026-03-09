import { useState, useMemo, useEffect, useCallback } from 'react';
import { useCategories, buildCategoryTree, Category } from '@/hooks/useCategories';
import { useProjections, useBulkReplicateProjection } from '@/hooks/useProjections';
import { usePersistedFilter } from '@/hooks/usePersistedFilter';
import { MonthRangePicker } from '@/components/MonthRangePicker';
import { formatBRL } from '@/lib/dre';
import { format, eachMonthOfInterval, addMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ChevronDown, ChevronRight, Copy, Save, ChevronsUpDown, Lock, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

const STORAGE_KEY = 'planejador-expanded-groups';
const REPLICATE_STORAGE_KEY = 'planejador-replicate-period';

function loadExpandedGroups(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

function saveExpandedGroups(groups: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...groups]));
}

function loadReplicatePeriod(): { start: string; end: string } | null {
  try {
    const raw = localStorage.getItem(REPLICATE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function saveReplicatePeriod(start: string, end: string) {
  localStorage.setItem(REPLICATE_STORAGE_KEY, JSON.stringify({ start, end }));
}

/** Returns the first future month (month after current) */
function getFirstFutureMonth(): string {
  const next = addMonths(startOfMonth(new Date()), 1);
  return format(next, 'yyyy-MM');
}

function isMonthEditable(month: string): boolean {
  const now = new Date();
  const currentMonth = format(startOfMonth(now), 'yyyy-MM');
  return month > currentMonth;
}

function ReplicateDialog({
  categoryName,
  categoryId,
  currentAmount,
  currentNotes,
}: {
  categoryName: string;
  categoryId: string;
  currentAmount: number;
  currentNotes?: string;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(currentAmount || ''));
  const [notes, setNotes] = useState(currentNotes || '');
  
  const savedPeriod = loadReplicatePeriod();
  const firstFuture = getFirstFutureMonth();
  const defaultStart = savedPeriod?.start && savedPeriod.start >= firstFuture ? savedPeriod.start : firstFuture;
  const defaultEnd = savedPeriod?.end && savedPeriod.end >= firstFuture ? savedPeriod.end : format(new Date(new Date().getFullYear(), 11, 1), 'yyyy-MM');
  
  const [startMonth, setStartMonth] = useState(defaultStart);
  const [endMonth, setEndMonth] = useState(defaultEnd);

  const allMonths = useMemo(() => {
    if (startMonth > endMonth) return [];
    const start = new Date(Number(startMonth.split('-')[0]), Number(startMonth.split('-')[1]) - 1, 1);
    const end = new Date(Number(endMonth.split('-')[0]), Number(endMonth.split('-')[1]) - 1, 1);
    return eachMonthOfInterval({ start, end }).map(d => format(d, 'yyyy-MM'));
  }, [startMonth, endMonth]);

  const [selectedMonths, setSelectedMonths] = useState<string[]>(allMonths);

  useEffect(() => {
    setSelectedMonths(allMonths);
  }, [allMonths]);

  const replicate = useBulkReplicateProjection();

  const toggleMonth = (m: string) => {
    setSelectedMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const handleReplicate = async () => {
    if (!amount || selectedMonths.length === 0) return;
    // Filter only future months
    const futureMonths = selectedMonths.filter(isMonthEditable);
    if (futureMonths.length === 0) {
      toast.error('Selecione ao menos um mês futuro.');
      return;
    }
    saveReplicatePeriod(startMonth, endMonth);
    await replicate.mutateAsync({
      category_id: categoryId,
      amount: Number(amount),
      months: futureMonths,
      notes,
    });
    toast.success(`Valor replicado para ${futureMonths.length} mês(es)`);
    setOpen(false);
  };

  // Generate month options for start/end selectors (next 24 months)
  const monthOptions = useMemo(() => {
    const opts: string[] = [];
    const start = new Date();
    start.setDate(1);
    start.setMonth(start.getMonth() + 1);
    for (let i = 0; i < 24; i++) {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i);
      opts.push(format(d, 'yyyy-MM'));
    }
    return opts;
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-1 hover:bg-muted rounded" title="Replicar para outros meses">
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replicar: {categoryName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Valor projetado</label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} step="0.01" className="mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Comentário</label>
            <Textarea 
              value={notes} 
              onChange={(e) => setNotes(e.target.value)} 
              placeholder="Descreva do que se trata esta despesa projetada..."
              className="mt-1 min-h-[80px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Início</label>
              <select value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1">
                {monthOptions.map(m => (
                  <option key={m} value={m}>{format(new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1), 'MMM/yyyy', { locale: ptBR })}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Fim</label>
              <select value={endMonth} onChange={(e) => setEndMonth(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm mt-1">
                {monthOptions.filter(m => m >= startMonth).map(m => (
                  <option key={m} value={m}>{format(new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1), 'MMM/yyyy', { locale: ptBR })}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Meses ({selectedMonths.length})</label>
              <Button variant="ghost" size="sm" className="text-xs h-6"
                onClick={() => setSelectedMonths(selectedMonths.length === allMonths.length ? [] : allMonths)}>
                {selectedMonths.length === allMonths.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
              {allMonths.map((m) => (
                <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={selectedMonths.includes(m)} onCheckedChange={() => toggleMonth(m)} />
                  <span className="capitalize">
                    {format(new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1), 'MMM/yy', { locale: ptBR })}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <Button onClick={handleReplicate} disabled={replicate.isPending || !amount || selectedMonths.length === 0} className="w-full">
            {replicate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Replicar para ${selectedMonths.length} mês(es)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type DraftMap = Map<string, number>;
type NotesMap = Map<string, string>;

export default function Planejador() {
  const filter = usePersistedFilter('planejador');
  const { data: categories, isLoading: catLoading } = useCategories();
  const { data: projections, isLoading: projLoading } = useProjections(filter.startDate, filter.endDate);
  const replicate = useBulkReplicateProjection();

  const tree = useMemo(() => (categories ? buildCategoryTree(categories) : []), [categories]);

  const months = useMemo(() => {
    const start = filter.parseMonth(filter.startMonth);
    const end = filter.parseMonth(filter.endMonth);
    return eachMonthOfInterval({ start, end }).map(d => format(d, 'yyyy-MM'));
  }, [filter.startMonth, filter.endMonth]);

  const savedMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!projections) return map;
    projections.forEach((p: any) => {
      const monthKey = typeof p.month === 'string' ? p.month.substring(0, 7) : p.month;
      const key = `${p.category_id}:${monthKey}`;
      map.set(key, Number(p.amount));
    });
    return map;
  }, [projections]);

  const savedNotesMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!projections) return map;
    projections.forEach((p: any) => {
      const monthKey = typeof p.month === 'string' ? p.month.substring(0, 7) : p.month;
      const key = `${p.category_id}:${monthKey}`;
      if (p.notes) map.set(key, p.notes);
    });
    return map;
  }, [projections]);

  const [draft, setDraft] = useState<DraftMap>(new Map());
  const [draftNotes, setDraftNotes] = useState<NotesMap>(new Map());
  const [isDirty, setIsDirty] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => loadExpandedGroups());

  useEffect(() => {
    saveExpandedGroups(expandedGroups);
  }, [expandedGroups]);

  const allGroupIds = useMemo(() => tree.map(c => c.id), [tree]);

  const toggleGroup = useCallback((id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setExpandedGroups(prev => {
      if (prev.size === allGroupIds.length) return new Set();
      return new Set(allGroupIds);
    });
  }, [allGroupIds]);

  const getDraftValue = (catId: string, month: string): number | undefined => {
    const key = `${catId}:${month}`;
    if (draft.has(key)) return draft.get(key);
    if (savedMap.has(key)) return savedMap.get(key);
    return undefined;
  };

  const getDraftNotes = (catId: string, month: string): string | undefined => {
    const key = `${catId}:${month}`;
    if (draftNotes.has(key)) return draftNotes.get(key);
    if (savedNotesMap.has(key)) return savedNotesMap.get(key);
    return undefined;
  };

  const setDraftValue = (catId: string, month: string, value: number) => {
    if (!isMonthEditable(month)) return;
    setDraft(prev => {
      const next = new Map(prev);
      next.set(`${catId}:${month}`, value);
      return next;
    });
    setIsDirty(true);
  };

  const setDraftNotesValue = (catId: string, month: string, notes: string) => {
    if (!isMonthEditable(month)) return;
    setDraftNotes(prev => {
      const next = new Map(prev);
      next.set(`${catId}:${month}`, notes);
      return next;
    });
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (draft.size === 0 && draftNotes.size === 0) return;

    // Group both amounts and notes
    const allKeys = new Set([...draft.keys(), ...draftNotes.keys()]);
    const grouped = new Map<string, { months: string[]; amount: number; notes?: string }[]>();
    
    allKeys.forEach(key => {
      const [catId, month] = key.split(':');
      if (!isMonthEditable(month)) return;
      
      const amount = draft.get(key) ?? getDraftValue(catId, month) ?? 0;
      const notes = draftNotes.get(key) ?? getDraftNotes(catId, month);
      
      if (!grouped.has(catId)) grouped.set(catId, []);
      grouped.get(catId)!.push({ months: [month], amount, notes });
    });

    for (const [catId, entries] of grouped) {
      const byAmountAndNotes = new Map<string, string[]>();
      entries.forEach(e => {
        const keyStr = `${e.amount}::${e.notes || ''}`;
        if (!byAmountAndNotes.has(keyStr)) byAmountAndNotes.set(keyStr, []);
        byAmountAndNotes.get(keyStr)!.push(e.months[0]);
      });

      for (const [keyStr, monthList] of byAmountAndNotes) {
        const [amountStr, notesStr] = keyStr.split('::');
        await replicate.mutateAsync({ 
          category_id: catId, 
          amount: Number(amountStr), 
          months: monthList, 
          notes: notesStr || undefined,
        });
      }
    }

    setDraft(new Map());
    setDraftNotes(new Map());
    setIsDirty(false);
    toast.success('Projeções salvas com sucesso!');
  };

  const loading = catLoading || projLoading;

  const periodLabel = filter.startMonth === filter.endMonth
    ? format(filter.parseMonth(filter.startMonth), "MMMM 'de' yyyy", { locale: ptBR })
    : `${format(filter.parseMonth(filter.startMonth), 'MMM/yy', { locale: ptBR })} a ${format(filter.parseMonth(filter.endMonth), 'MMM/yy', { locale: ptBR })}`;

  const allExpanded = expandedGroups.size === allGroupIds.length;

  return (
    <div className="max-w-full mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Planejador</h1>
          <p className="text-sm text-muted-foreground capitalize">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleAll} className="gap-1.5">
            <ChevronsUpDown className="h-4 w-4" />
            {allExpanded ? 'Recolher' : 'Expandir'}
          </Button>
          <MonthRangePicker
            startMonth={filter.startMonth}
            endMonth={filter.endMonth}
            onStartChange={filter.setStartMonth}
            onEndChange={filter.setEndMonth}
            onYearClick={() => filter.setFullYear()}
          />
          <Button onClick={handleSave} disabled={!isDirty || replicate.isPending} className="gap-1.5" size="sm">
            {replicate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
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
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[hsl(var(--table-total-bg))] text-[hsl(var(--table-total-fg))]">
                    <th className="text-left py-3 px-4 font-semibold min-w-[200px] sticky left-0 bg-[hsl(var(--table-total-bg))] z-20">Categoria</th>
                    {months.map(m => {
                      const editable = isMonthEditable(m);
                      return (
                        <th key={m} className={`text-center py-3 px-2 font-semibold min-w-[100px] capitalize ${!editable ? 'opacity-50' : ''}`}>
                          <div className="flex items-center justify-center gap-1">
                            {!editable && <Lock className="h-3 w-3" />}
                            {format(filter.parseMonth(m), 'MMM/yy', { locale: ptBR })}
                          </div>
                        </th>
                      );
                    })}
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {tree.map((cat) => (
                    <CategoryRowMultiMonth
                      key={cat.id}
                      cat={cat}
                      months={months}
                      getDraftValue={getDraftValue}
                      getDraftNotes={getDraftNotes}
                      setDraftValue={setDraftValue}
                      setDraftNotesValue={setDraftNotesValue}
                      expanded={expandedGroups.has(cat.id)}
                      onToggle={() => toggleGroup(cat.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {isDirty && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg text-sm flex items-center gap-2">
          <span>Alterações não salvas</span>
          <Button size="sm" variant="secondary" onClick={handleSave} disabled={replicate.isPending}>
            {replicate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salvar agora'}
          </Button>
        </div>
      )}
    </div>
  );
}

function CategoryRowMultiMonth({
  cat, months, getDraftValue, setDraftValue, expanded, onToggle,
}: {
  cat: Category;
  months: string[];
  getDraftValue: (catId: string, month: string) => number | undefined;
  setDraftValue: (catId: string, month: string, value: number) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasChildren = cat.children && cat.children.length > 0;

  const monthTotals = useMemo(() => {
    if (!cat.children) return months.map(() => 0);
    return months.map(m => cat.children!.reduce((sum, c) => sum + (getDraftValue(c.id, m) || 0), 0));
  }, [cat.children, months, getDraftValue]);

  return (
    <>
      <tr className="bg-[hsl(var(--table-cat-bg))] text-[hsl(var(--table-cat-fg))] font-semibold border-b border-border/30">
        <td className="py-2.5 px-4 flex items-center gap-1">
          {hasChildren && (
            <button onClick={onToggle} className="p-0.5">
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          )}
          {cat.name}
        </td>
        {monthTotals.map((total, i) => (
          <td key={months[i]} className="text-center py-2.5 px-2 tabular-nums text-sm">{formatBRL(total)}</td>
        ))}
        <td />
      </tr>
      {expanded && cat.children?.map((sub) => (
        <tr key={sub.id} className="border-b border-border/30 bg-[hsl(var(--table-subcat-bg))] text-[hsl(var(--table-subcat-fg))]">
          <td className="py-1.5 px-4 pl-10 text-sm">{sub.name}</td>
          {months.map(m => {
            const val = getDraftValue(sub.id, m);
            const editable = isMonthEditable(m);
            return (
              <td key={m} className={`py-1.5 px-1 ${!editable ? 'bg-muted/20' : ''}`}>
                {editable ? (
                  <Input
                    type="number"
                    className="w-full text-center h-7 text-xs"
                    value={val !== undefined ? val : ''}
                    onChange={(e) => setDraftValue(sub.id, m, Number(e.target.value) || 0)}
                    placeholder="0"
                    step="0.01"
                  />
                ) : (
                  <div className="w-full text-center h-7 text-xs flex items-center justify-center text-muted-foreground/60">
                    {val !== undefined ? formatBRL(val) : '—'}
                  </div>
                )}
              </td>
            );
          })}
          <td className="py-1.5 px-1">
            <ReplicateDialog categoryName={sub.name} categoryId={sub.id} currentAmount={getDraftValue(sub.id, months[0]) || 0} />
          </td>
        </tr>
      ))}
    </>
  );
}
