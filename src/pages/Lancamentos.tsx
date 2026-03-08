import { useState } from 'react';
import { useCategories, buildCategoryTree, Category } from '@/hooks/useCategories';
import { useCreateTransaction } from '@/hooks/useTransactions';
import { useAuth } from '@/contexts/AuthContext';
import { useUserPlan, useTransactionCount, FREE_TX_LIMIT } from '@/hooks/useUserPlan';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, Plus, Loader2, FolderPlus, Trash2, AlertTriangle, Pencil, Check, X, ArrowRightLeft } from 'lucide-react';
import { ExcelUpload } from '@/components/ExcelUpload';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const DRE_TYPE_COLORS: Record<string, string> = {
  receita: 'border-l-[hsl(var(--chart-receita))]',
  desconto: 'border-l-[hsl(var(--chart-desconto))]',
  custo: 'border-l-[hsl(var(--chart-custo))]',
  despesa: 'border-l-[hsl(var(--chart-despesa))]',
  investimento: 'border-l-[hsl(var(--chart-investimento))]',
};

const DRE_TYPE_LABELS: Record<string, string> = {
  receita: 'Receita',
  desconto: 'Desconto',
  custo: 'Custo',
  despesa: 'Despesa',
  depreciacao: 'Depreciação',
  resultado_financeiro: 'Resultado Financeiro',
  outras_receitas: 'Outras Receitas',
  impostos: 'Impostos',
  investimento: 'Investimento',
};

function EditCategoryInline({ categoryId, currentName, onDone }: { categoryId: string; currentName: string; onDone: () => void }) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    if (!name.trim() || name.trim() === currentName) { onDone(); return; }
    setSaving(true);
    const { error } = await supabase.from('categories').update({ name: name.trim() }).eq('id', categoryId);
    if (error) {
      toast.error('Erro ao renomear: ' + error.message);
    } else {
      toast.success('Categoria renomeada!');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    }
    setSaving(false);
    onDone();
  };

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-7 text-xs w-40"
        autoFocus
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onDone(); }}
      />
      <button onClick={handleSave} disabled={saving} className="p-1 hover:bg-primary/10 rounded">
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-primary" />}
      </button>
      <button onClick={onDone} className="p-1 hover:bg-muted rounded">
        <X className="h-3 w-3 text-muted-foreground" />
      </button>
    </div>
  );
}

function DeleteCategoryButton({ categoryId, categoryName, hasChildren }: { categoryId: string; categoryName: string; hasChildren?: boolean }) {
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  const handleDelete = async () => {
    setDeleting(true);
    if (hasChildren) {
      const { error: childError } = await supabase.from('categories').delete().eq('parent_id', categoryId);
      if (childError) {
        toast.error('Erro ao excluir subcategorias: ' + childError.message);
        setDeleting(false);
        return;
      }
    }
    const { error } = await supabase.from('categories').delete().eq('id', categoryId);
    if (error) {
      if (error.message.includes('foreign key') || error.message.includes('violates')) {
        toast.error('Não é possível excluir: existem lançamentos vinculados a esta categoria.');
      } else {
        toast.error('Erro: ' + error.message);
      }
    } else {
      toast.success(`"${categoryName}" excluída!`);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    }
    setDeleting(false);
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button className="p-1 hover:bg-destructive/10 rounded transition-colors" title="Excluir">
          <Trash2 className="h-3.5 w-3.5 text-destructive/70 hover:text-destructive" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir "{categoryName}"?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasChildren
              ? 'Esta categoria e todas as suas subcategorias serão removidas. Lançamentos existentes vinculados impedirão a exclusão.'
              : 'Esta subcategoria será removida. Lançamentos existentes vinculados impedirão a exclusão.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MoveSubcategoryButton({ subcategory, parentCategories }: { subcategory: Category; parentCategories: Category[] }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [targetParentId, setTargetParentId] = useState('');
  const queryClient = useQueryClient();

  const available = parentCategories.filter(p => p.id !== subcategory.parent_id);

  const handleMove = async () => {
    if (!targetParentId) return;
    setSaving(true);
    const targetParent = parentCategories.find(p => p.id === targetParentId);
    const { error } = await supabase.from('categories').update({
      parent_id: targetParentId,
      dre_type: (targetParent?.dre_type || subcategory.dre_type) as any,
    }).eq('id', subcategory.id);
    if (error) {
      toast.error('Erro ao mover: ' + error.message);
    } else {
      toast.success(`"${subcategory.name}" movida com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    }
    setSaving(false);
    setOpen(false);
    setTargetParentId('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="p-1 hover:bg-muted rounded transition-colors" title="Mover para outra categoria">
          <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mover "{subcategory.name}"</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Selecione a nova categoria pai. Os lançamentos existentes serão mantidos.</p>
        <Select value={targetParentId} onValueChange={setTargetParentId}>
          <SelectTrigger><SelectValue placeholder="Selecione a nova categoria..." /></SelectTrigger>
          <SelectContent>
            {available.map(p => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} <span className="text-muted-foreground ml-1">({DRE_TYPE_LABELS[p.dre_type] || p.dre_type})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleMove} disabled={saving || !targetParentId} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Mover Subcategoria'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function SubcategoryRow({ cat, onSubmit, parentCategories }: { cat: Category; onSubmit: (data: any) => void; parentCategories: Category[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [comment, setComment] = useState('');
  const [isInstallment, setIsInstallment] = useState(false);
  const [installments, setInstallments] = useState('2');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    if (!amount || Number(amount) === 0) return;
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
      <div className="w-full flex items-center justify-between py-2 px-3 text-sm hover:bg-muted/50 rounded transition-colors">
        {editing ? (
          <EditCategoryInline categoryId={cat.id} currentName={cat.name} onDone={() => setEditing(false)} />
        ) : (
          <button onClick={() => setOpen(!open)} className="flex-1 text-left flex items-center gap-1">
            <span>{cat.name}</span>
          </button>
        )}
        <div className="flex items-center gap-1">
          <button onClick={() => setEditing(true)} className="p-1 hover:bg-muted rounded transition-colors" title="Editar">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
          <MoveSubcategoryButton subcategory={cat} parentCategories={parentCategories} />
          <DeleteCategoryButton categoryId={cat.id} categoryName={cat.name} />
          <Plus className="h-3.5 w-3.5 text-muted-foreground cursor-pointer" onClick={() => setOpen(!open)} />
        </div>
      </div>
      {open && (
        <div className="px-3 pb-3 space-y-2 bg-muted/30 rounded-b">
          <div className="flex gap-2">
            <Input type="number" placeholder="Valor (R$) — negativo para estorno" value={amount} onChange={(e) => setAmount(e.target.value)} className="flex-1" autoFocus step="0.01" />
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-36" />
          </div>
          <Input placeholder="Comentário (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="flex items-center gap-2">
            <Switch checked={isInstallment} onCheckedChange={setIsInstallment} />
            <span className="text-xs text-muted-foreground">Parcelado</span>
            {isInstallment && (
              <Input type="number" placeholder="Parcelas" value={installments} onChange={(e) => setInstallments(e.target.value)} className="w-20" min="2" max="60" />
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">💡 Use valor negativo para corrigir/estornar um lançamento</p>
          <Button onClick={handleSave} disabled={submitting || !amount} size="sm" className="w-full">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'SALVAR'}
          </Button>
        </div>
      )}
    </div>
  );
}

function AddSubcategoryForm({ parentId, onDone }: { parentId: string; onDone: () => void }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleAdd = async () => {
    if (!name.trim() || !user) return;
    setSaving(true);
    const { error } = await supabase.from('categories').insert({
      user_id: user.id,
      name: name.trim(),
      dre_type: 'despesa',
      parent_id: parentId,
      sort_order: 99,
    });
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success('Subcategoria criada!');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      onDone();
    }
    setSaving(false);
  };

  return (
    <div className="flex gap-2 px-3 py-2">
      <Input placeholder="Nome da subcategoria" value={name} onChange={(e) => setName(e.target.value)} className="flex-1 h-8 text-xs" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
      <Button size="sm" onClick={handleAdd} disabled={saving} className="h-8 text-xs">
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Criar'}
      </Button>
    </div>
  );
}

function CategoryGroup({ cat, onSubmit }: { cat: Category; onSubmit: (data: any) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [editing, setEditing] = useState(false);
  const colorClass = DRE_TYPE_COLORS[cat.dre_type] || '';

  return (
    <Card className={`border-l-4 ${colorClass} overflow-hidden`}>
      <div className="w-full flex items-center justify-between p-3 text-left font-semibold text-sm hover:bg-muted/30 transition-colors">
        {editing ? (
          <EditCategoryInline categoryId={cat.id} currentName={cat.name} onDone={() => setEditing(false)} />
        ) : (
          <button onClick={() => setExpanded(!expanded)} className="flex-1 flex items-center gap-1">
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <span>{cat.name}</span>
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-normal">{cat.children?.length || 0} sub</span>
          <button onClick={() => setEditing(true)} className="p-1 hover:bg-muted rounded transition-colors" title="Editar">
            <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
          {!cat.is_default && (
            <DeleteCategoryButton categoryId={cat.id} categoryName={cat.name} hasChildren={(cat.children?.length || 0) > 0} />
          )}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border divide-y divide-border/50">
          {cat.children?.map((sub) => (
            <SubcategoryRow key={sub.id} cat={sub} onSubmit={onSubmit} />
          ))}
          {addingSub ? (
            <AddSubcategoryForm parentId={cat.id} onDone={() => setAddingSub(false)} />
          ) : (
            <button
              onClick={() => setAddingSub(true)}
              className="w-full flex items-center gap-1 py-2 px-3 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <Plus className="h-3 w-3" /> Adicionar subcategoria
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

function AddCategoryDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [dreType, setDreType] = useState('despesa');
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleCreate = async () => {
    if (!name.trim() || !user) return;
    setSaving(true);
    const { error } = await supabase.from('categories').insert({
      user_id: user.id,
      name: name.trim().toUpperCase(),
      dre_type: dreType as any,
      sort_order: 99,
    });
    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success('Categoria criada!');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setName('');
      setOpen(false);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <FolderPlus className="h-4 w-4" /> Nova Categoria
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Categoria</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Nome da categoria" value={name} onChange={(e) => setName(e.target.value)} />
          <Select value={dreType} onValueChange={setDreType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(DRE_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleCreate} disabled={saving || !name.trim()} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar Categoria'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Lancamentos() {
  const { data: categories, isLoading } = useCategories();
  const createTx = useCreateTransaction();
  const { isPremium } = useUserPlan();
  const { data: txCount } = useTransactionCount();
  const tree = categories ? buildCategoryTree(categories) : [];
  const limitReached = !isPremium && (txCount || 0) >= FREE_TX_LIMIT;

  const handleSubmit = async (data: any) => {
    if (limitReached) {
      const { toast } = await import('sonner');
      toast.error(`Limite de ${FREE_TX_LIMIT} lançamentos/mês atingido. Faça upgrade para Premium.`);
      return;
    }
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Lançamentos</h1>
          <p className="text-sm text-muted-foreground">Clique na subcategoria para lançar rapidamente</p>
          {!isPremium && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {limitReached && <AlertTriangle className="h-3 w-3 text-destructive" />}
              {txCount || 0}/{FREE_TX_LIMIT} lançamentos este mês
              {limitReached && <span className="text-destructive font-medium"> — Limite atingido</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ExcelUpload />
          <AddCategoryDialog />
        </div>
      </div>
      {tree.map((cat) => (
        <CategoryGroup key={cat.id} cat={cat} onSubmit={handleSubmit} />
      ))}
    </div>
  );
}
