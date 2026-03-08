import { useState, useMemo } from 'react';
import { useCategories, buildCategoryTree, Category } from '@/hooks/useCategories';
import { useProjections, useBulkReplicateProjection } from '@/hooks/useProjections';
import { usePersistedFilter } from '@/hooks/usePersistedFilter';
import { MonthRangePicker } from '@/components/MonthRangePicker';
import { formatBRL } from '@/lib/dre';
import { format, eachMonthOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ChevronDown, ChevronRight, Copy, Save, ChevronsUpDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

function ReplicateDialog({
  categoryName,
  categoryId,
  currentAmount,
}: {
  categoryName: string;
  categoryId: string;
  currentAmount: number;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(currentAmount || ''));
  const year = new Date().getFullYear();
  const allMonths = Array.from({ length: 12 }, (_, i) =>
    `${year}-${String(i + 1).padStart(2, '0')}`
  );
  const [selectedMonths, setSelectedMonths] = useState<string[]>(allMonths);
  const replicate = useBulkReplicateProjection();

  const toggleMonth = (m: string) => {
    setSelectedMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const handleReplicate = async () => {
    if (!amount || selectedMonths.length === 0) return;
    await replicate.mutateAsync({
      category_id: categoryId,
      amount: Number(amount),
      months: selectedMonths,
    });
    toast.success(`Valor replicado para ${selectedMonths.length} mês(es)`);
    setOpen(false);
  };

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
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Meses</label>
              <Button variant="ghost" size="sm" className="text-xs h-6"
                onClick={() => setSelectedMonths(selectedMonths.length === 12 ? [] : allMonths)}>
                {selectedMonths.length === 12 ? 'Desmarcar todos' : 'Selecionar todos'}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
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

  const [draft, setDraft] = useState<DraftMap>(new Map());
  const [isDirty, setIsDirty] = useState(false);
  const [allExpanded, setAllExpanded] = useState(true);

  const getDraftValue = (catId: string, month: string): number | undefined => {
    const key = `${catId}:${month}`;
    if (draft.has(key)) return draft.get(key);
    if (savedMap.has(key)) return savedMap.get(key);
    return undefined;
  };

  const setDraftValue = (catId: string, month: string, value: number) => {
    setDraft(prev => {
      const next = new Map(prev);
      next.set(`${catId}:${month}`, value);
      return next;
    });
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (draft.size === 0) return;

    const grouped = new Map<string, { months: string[]; amount: number }[]>();
    draft.forEach((amount, key) => {
      const [catId, month] = key.split(':');
      if (!grouped.has(catId)) grouped.set(catId, []);
      grouped.get(catId)!.push({ months: [month], amount });
    });

    for (const [catId, entries] of grouped) {
      const byAmount = new Map<number, string[]>();
      entries.forEach(e => {
        if (!byAmount.has(e.amount)) byAmount.set(e.amount, []);
        byAmount.get(e.amount)!.push(e.months[0]);
      });

      for (const [amount, monthList] of byAmount) {
        await replicate.mutateAsync({ category_id: catId, amount, months: monthList });
      }
    }

    setDraft(new Map());
    setIsDirty(false);
    toast.success('Projeções salvas com sucesso!');
  };

  const loading = catLoading || projLoading;

  const periodLabel = filter.startMonth === filter.endMonth
    ? format(filter.parseMonth(filter.startMonth), "MMMM 'de' yyyy", { locale: ptBR })
    : `${format(filter.parseMonth(filter.startMonth), 'MMM/yy', { locale: ptBR })} a ${format(filter.parseMonth(filter.endMonth), 'MMM/yy', { locale: ptBR })}`;

  return (
    <div className="max-w-full mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Planejador</h1>
          <p className="text-sm text-muted-foreground capitalize">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAllExpanded(prev => !prev)} className="gap-1.5">
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
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground min-w-[200px]">Categoria</th>
                    {months.map(m => (
                      <th key={m} className="text-center py-3 px-2 font-medium text-muted-foreground min-w-[100px] capitalize">
                        {format(filter.parseMonth(m), 'MMM/yy', { locale: ptBR })}
                      </th>
                    ))}
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
                      setDraftValue={setDraftValue}
                      forceExpanded={allExpanded}
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
  cat, months, getDraftValue, setDraftValue, forceExpanded,
}: {
  cat: Category;
  months: string[];
  getDraftValue: (catId: string, month: string) => number | undefined;
  setDraftValue: (catId: string, month: string, value: number) => void;
  forceExpanded: boolean;
}) {
  const [localExpanded, setLocalExpanded] = useState(true);
  const expanded = forceExpanded !== undefined ? forceExpanded : localExpanded;
  const hasChildren = cat.children && cat.children.length > 0;

  const monthTotals = useMemo(() => {
    if (!cat.children) return months.map(() => 0);
    return months.map(m => cat.children!.reduce((sum, c) => sum + (getDraftValue(c.id, m) || 0), 0));
  }, [cat.children, months, getDraftValue]);

  return (
    <>
      <tr className="bg-muted/30 font-semibold border-b border-border/50">
        <td className="py-2 px-4 flex items-center gap-1">
          {hasChildren && (
            <button onClick={() => setLocalExpanded(!localExpanded)} className="p-0.5">
              {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          )}
          {cat.name}
        </td>
        {monthTotals.map((total, i) => (
          <td key={months[i]} className="text-center py-2 px-2 tabular-nums text-sm">{formatBRL(total)}</td>
        ))}
        <td />
      </tr>
      {expanded && cat.children?.map((sub) => (
        <tr key={sub.id} className="border-b border-border/50">
          <td className="py-1.5 px-4 pl-10 text-sm">{sub.name}</td>
          {months.map(m => {
            const val = getDraftValue(sub.id, m);
            return (
              <td key={m} className="py-1.5 px-1">
                <Input
                  type="number"
                  className="w-full text-center h-7 text-xs"
                  value={val !== undefined ? val : ''}
                  onChange={(e) => setDraftValue(sub.id, m, Number(e.target.value) || 0)}
                  placeholder="0"
                  step="0.01"
                />
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
