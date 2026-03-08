import { useState, useMemo } from 'react';
import { useCategories, buildCategoryTree, Category } from '@/hooks/useCategories';
import { useProjections, useUpsertProjection, useBulkReplicateProjection } from '@/hooks/useProjections';
import { usePersistedFilter } from '@/hooks/usePersistedFilter';
import { MonthRangePicker } from '@/components/MonthRangePicker';
import { formatBRL } from '@/lib/dre';
import { format, eachMonthOfInterval, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ChevronDown, ChevronRight, Copy } from 'lucide-react';
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
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
              className="mt-1"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Meses</label>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6"
                onClick={() =>
                  setSelectedMonths(selectedMonths.length === 12 ? [] : allMonths)
                }
              >
                {selectedMonths.length === 12 ? 'Desmarcar todos' : 'Selecionar todos'}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {allMonths.map((m) => (
                <label
                  key={m}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={selectedMonths.includes(m)}
                    onCheckedChange={() => toggleMonth(m)}
                  />
                  <span className="capitalize">
                    {format(new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1), 'MMM/yy', { locale: ptBR })}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <Button
            onClick={handleReplicate}
            disabled={replicate.isPending || !amount || selectedMonths.length === 0}
            className="w-full"
          >
            {replicate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `Replicar para ${selectedMonths.length} mês(es)`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CategoryRow({
  cat,
  projectionMap,
  month,
}: {
  cat: Category;
  projectionMap: Map<string, number>;
  month: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const upsert = useUpsertProjection();
  const hasChildren = cat.children && cat.children.length > 0;

  const childTotal = useMemo(() => {
    if (!cat.children) return 0;
    return cat.children.reduce((sum, c) => sum + (projectionMap.get(c.id) || 0), 0);
  }, [cat.children, projectionMap]);

  return (
    <>
      <tr className="bg-muted/30 font-semibold border-b border-border/50">
        <td className="py-2 px-4 flex items-center gap-1">
          {hasChildren && (
            <button onClick={() => setExpanded(!expanded)} className="p-0.5">
              {expanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          )}
          {cat.name}
        </td>
        <td className="text-right py-2 px-4 tabular-nums text-sm">
          {formatBRL(childTotal)}
        </td>
        <td />
      </tr>
      {expanded &&
        cat.children?.map((sub) => {
          const currentVal = projectionMap.get(sub.id) || 0;
          return (
            <tr key={sub.id} className="border-b border-border/50">
              <td className="py-1.5 px-4 pl-10 text-sm">{sub.name}</td>
              <td className="text-right py-1.5 px-4">
                <Input
                  type="number"
                  className="w-28 ml-auto text-right h-7 text-xs"
                  value={projectionMap.has(sub.id) ? currentVal : ''}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    projectionMap.set(sub.id, val);
                    upsert.mutate({
                      category_id: sub.id,
                      month,
                      amount: val,
                    });
                  }}
                  placeholder="0,00"
                  step="0.01"
                />
              </td>
              <td className="py-1.5 px-2">
                <ReplicateDialog
                  categoryName={sub.name}
                  categoryId={sub.id}
                  currentAmount={currentVal}
                />
              </td>
            </tr>
          );
        })}
    </>
  );
}

export default function Planejador() {
  const filter = usePersistedFilter('planejador');

  const { data: categories, isLoading: catLoading } = useCategories();
  const { data: projections, isLoading: projLoading } = useProjections(filter.startDate, filter.endDate);

  const tree = useMemo(() => (categories ? buildCategoryTree(categories) : []), [categories]);

  const projectionMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!projections) return map;
    projections.forEach((p: any) => {
      const key = p.category_id;
      map.set(key, (map.get(key) || 0) + Number(p.amount));
    });
    return map;
  }, [projections]);

  const loading = catLoading || projLoading;

  const startLabel = format(filter.parseMonth(filter.startMonth), "MMM/yy", { locale: ptBR });
  const endLabel = format(filter.parseMonth(filter.endMonth), "MMM/yy", { locale: ptBR });
  const periodLabel = filter.startMonth === filter.endMonth
    ? format(filter.parseMonth(filter.startMonth), "MMMM 'de' yyyy", { locale: ptBR })
    : `${startLabel} a ${endLabel}`;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Planejador</h1>
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Categoria</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Projetado (R$)</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {tree.map((cat) => (
                    <CategoryRow
                      key={cat.id}
                      cat={cat}
                      projectionMap={projectionMap}
                      month={filter.startMonth}
                    />
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
