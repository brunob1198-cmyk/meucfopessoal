import { useState } from 'react';
import { useCategories, buildCategoryTree, Category } from '@/hooks/useCategories';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, Plus, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';

const DRE_TYPE_COLORS: Record<string, string> = {
  receita: 'border-l-[hsl(var(--chart-receita))]',
  desconto: 'border-l-[hsl(var(--chart-desconto))]',
  custo: 'border-l-[hsl(var(--chart-custo))]',
  despesa: 'border-l-[hsl(var(--chart-despesa))]',
  investimento: 'border-l-[hsl(var(--chart-investimento))]',
};

function SubcategoryRow({ cat, onSubmit }: { cat: Category; onSubmit: (data: any) => void }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [comment, setComment] = useState('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [installments, setInstallments] = useState('2');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) return;
    setSubmitting(true);
    await onSubmit({
      category_id: cat.id,
      amount: Number(amount),
      date,
      comment: comment || undefined,
      is_installment: isInstallment,
      total_installments: isInstallment ? Number(installments) : undefined,
    });
    setAmount('');
    setComment('');
    setIsInstallment(false);
    setInstallments('2');
    setOpen(false);
    setSubmitting(false);
  };

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-2 px-3 text-sm hover:bg-muted/50 rounded transition-colors"
      >
        <span>{cat.name}</span>
        <Plus className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 bg-muted/30 rounded-b">
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Valor (R$)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1"
              autoFocus
              step="0.01"
              min="0"
            />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-36"
            />
          </div>
          <Input
            placeholder="Comentário (opcional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Switch checked={isInstallment} onCheckedChange={setIsInstallment} />
            <span className="text-xs text-muted-foreground">Parcelado</span>
            {isInstallment && (
              <Input
                type="number"
                placeholder="Parcelas"
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                className="w-20"
                min="2"
                max="60"
              />
            )}
          </div>
          <Button
            onClick={handleSave}
            disabled={submitting || !amount}
            size="sm"
            className="w-full"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'SALVAR'}
          </Button>
        </div>
      )}
    </div>
  );
}

function CategoryGroup({ cat, onSubmit }: { cat: Category; onSubmit: (data: any) => void }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = DRE_TYPE_COLORS[cat.dre_type] || '';

  return (
    <Card className={`border-l-4 ${colorClass} overflow-hidden`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 text-left font-semibold text-sm hover:bg-muted/30 transition-colors"
      >
        <span>{cat.name}</span>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {expanded && cat.children && (
        <div className="border-t border-border divide-y divide-border/50">
          {cat.children.map((sub) => (
            <SubcategoryRow key={sub.id} cat={sub} onSubmit={onSubmit} />
          ))}
        </div>
      )}
    </Card>
  );
}

export default function Lancamentos() {
  const { data: categories, isLoading } = useCategories();
  const createTx = useCreateTransaction();
  const tree = categories ? buildCategoryTree(categories) : [];

  const handleSubmit = async (data: any) => {
    await createTx.mutateAsync(data);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">Lançamentos</h1>
        <p className="text-sm text-muted-foreground">Clique na subcategoria para lançar rapidamente</p>
      </div>
      {tree.map((cat) => (
        <CategoryGroup key={cat.id} cat={cat} onSubmit={handleSubmit} />
      ))}
    </div>
  );
}
