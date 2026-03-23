import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Wand2 } from 'lucide-react';
import { Category } from '@/hooks/useCategories';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTransactions } from '@/hooks/useTransactions';
import { formatBRL } from '@/lib/dre';
import { toast } from 'sonner';

interface SuggestPlannerDialogProps {
  tree: Category[];
  availableMonths: string[]; // only editable future months
  setDraftValue: (catId: string, month: string, value: number) => void;
  setDraftNotesValue: (catId: string, month: string, notes: string) => void;
}

export function SuggestPlannerDialog({ tree, availableMonths, setDraftValue, setDraftNotesValue }: SuggestPlannerDialogProps) {
  const [open, setOpen] = useState(false);

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(subMonths(now, 3));
    const end = endOfMonth(subMonths(now, 1));
    return {
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
    };
  }, []);

  const { data: transactions, isLoading } = useTransactions(startDate, endDate);

  const categoryAverages = useMemo(() => {
    if (!transactions) return new Map<string, number>();

    const sums = new Map<string, number>();
    transactions.forEach(t => {
      if (t.category_id) {
        sums.set(t.category_id, (sums.get(t.category_id) || 0) + Number(t.amount));
      }
    });

    const avgs = new Map<string, number>();
    sums.forEach((total, catId) => {
      avgs.set(catId, total / 3);
    });
    return avgs;
  }, [transactions]);

  const subcategories = useMemo(() => {
    const list: { id: string; name: string; parentName: string; avg: number }[] = [];
    tree.forEach(cat => {
      cat.children?.forEach(sub => {
        const avg = categoryAverages.get(sub.id) || 0;
        list.push({
          id: sub.id,
          name: sub.name,
          parentName: cat.name,
          avg
        });
      });
    });
    return list;
  }, [tree, categoryAverages]);

  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Initialize selections when dialog opens or data loads
  useEffect(() => {
    if (open) {
      setSelectedMonths(availableMonths);
      if (transactions) {
        setSelectedCategories(subcategories.filter(s => s.avg > 0).map(s => s.id));
      }
    }
  }, [open, transactions, availableMonths, subcategories]);

  const handleApply = () => {
    if (selectedMonths.length === 0 || selectedCategories.length === 0) return;

    let appliedCount = 0;
    selectedCategories.forEach(catId => {
      const avg = categoryAverages.get(catId) || 0;
      if (avg <= 0) return;

      selectedMonths.forEach(month => {
        setDraftValue(catId, month, avg);
        setDraftNotesValue(catId, month, "Sugestão baseada na média dos últimos 3 meses");
        appliedCount++;
      });
    });

    toast.success(`Sugestão aplicada a ${appliedCount} campos.`);
    setOpen(false);
  };

  const toggleMonth = (m: string) => {
    setSelectedMonths((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]
    );
  };

  const toggleCategory = (id: string, disabled: boolean) => {
    if (disabled) return;
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const validCategoriesCount = subcategories.filter(s => s.avg > 0).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5" title="Sugerir com base no histórico">
          <Wand2 className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">Sugerir</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Sugerir Planejamento</DialogTitle>
          <DialogDescription>
            Calcula a média de gastos dos últimos 3 meses ({format(new Date(startDate + "T00:00:00"), 'MMM/yy', { locale: ptBR })} a {format(new Date(endDate + "T00:00:00"), 'MMM/yy', { locale: ptBR })}) 
            e aplica às categorias e meses selecionados. Categorias sem lançamentos neste período não terão sugestão.
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Analisando histórico de transações...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Aplicar nos meses ({selectedMonths.length})</label>
                <Button variant="ghost" size="sm" className="text-xs h-6 px-2"
                  onClick={() => setSelectedMonths(selectedMonths.length === availableMonths.length ? [] : availableMonths)}>
                  {selectedMonths.length === availableMonths.length ? 'Desmarcar todos' : 'Selecionar todos'}
                </Button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                {availableMonths.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm cursor-pointer p-2 rounded-md border border-input hover:bg-muted/50 transition-colors">
                    <Checkbox checked={selectedMonths.includes(m)} onCheckedChange={() => toggleMonth(m)} />
                    <span className="capitalize">
                      {format(new Date(Number(m.split('-')[0]), Number(m.split('-')[1]) - 1, 1), 'MMM/yy', { locale: ptBR })}
                    </span>
                  </label>
                ))}
              </div>
              {availableMonths.length === 0 && (
                <p className="text-sm text-destructive">Não há meses futuros selecionados no filtro principal do planejador.</p>
              )}
            </div>

            <div className="flex-1 overflow-y-auto min-h-[250px] border rounded-md">
              <div className="sticky top-0 bg-muted/80 backdrop-blur z-10 px-4 py-2 border-b flex items-center justify-between">
                <span className="text-sm font-medium">Categorias ({selectedCategories.length} selecionadas)</span>
                <Button variant="ghost" size="sm" className="text-xs h-6 px-2"
                  onClick={() => setSelectedCategories(selectedCategories.length === validCategoriesCount ? [] : subcategories.filter(s => s.avg > 0).map(s => s.id))}>
                  {selectedCategories.length === validCategoriesCount ? 'Desmarcar todas com dados' : 'Selecionar todas com dados'}
                </Button>
              </div>
              <div className="p-2 space-y-1">
                {subcategories.map(sub => {
                  const noData = sub.avg === 0;
                  const selected = selectedCategories.includes(sub.id);
                  return (
                    <label 
                      key={sub.id} 
                      className={`flex items-center justify-between p-2 rounded-md transition-colors ${noData ? 'opacity-60 cursor-not-allowed bg-muted/30' : 'hover:bg-muted/50 cursor-pointer'}`}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <Checkbox 
                          checked={selected} 
                          disabled={noData}
                          onCheckedChange={() => toggleCategory(sub.id, noData)} 
                        />
                        <div className="truncate">
                          <p className="text-sm font-medium truncate">{sub.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{sub.parentName}</p>
                        </div>
                      </div>
                      <div className="text-right whitespace-nowrap ml-4">
                        {noData ? (
                          <span className="text-xs text-muted-foreground mr-1">Sem lançamentos</span>
                        ) : (
                          <span className="text-sm font-medium">{formatBRL(sub.avg)}<span className="text-xs text-muted-foreground font-normal ml-1">/mês</span></span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button 
            onClick={handleApply} 
            disabled={isLoading || selectedMonths.length === 0 || selectedCategories.length === 0}
          >
            Aplicar Sugestões
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
