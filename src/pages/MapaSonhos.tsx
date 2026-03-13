import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInMonths, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Home, Car, Plane, Stethoscope, GraduationCap,
  Landmark, TrendingUp, Star, Trash2, Check, Sparkles,
  Target, PartyPopper, AlertTriangle, Clock, Edit2
} from 'lucide-react';

type DreamCategory = string;
type DreamStatus = 'em_progresso' | 'proximo' | 'em_risco' | 'concluido';

interface Dream {
  id: string;
  name: string;
  category: DreamCategory;
  custom_category: string | null;
  target_value: number;
  accumulated_value: number;
  target_date: string | null;
  description: string | null;
  status: DreamStatus;
  completed_at: string | null;
  created_at: string;
}

const getDisplayCategory = (dream: Dream): string => dream.custom_category || dream.category;

const defaultCategoryConfig: Record<string, { label: string; icon: typeof Home; color: string }> = {
  casa_propria: { label: 'Casa Própria', icon: Home, color: 'hsl(160 78% 49%)' },
  carro: { label: 'Carro', icon: Car, color: 'hsl(210 60% 50%)' },
  viagem: { label: 'Viagem', icon: Plane, color: 'hsl(28 100% 63%)' },
  cirurgia: { label: 'Cirurgia', icon: Stethoscope, color: 'hsl(0 72% 51%)' },
  educacao: { label: 'Educação', icon: GraduationCap, color: 'hsl(280 60% 50%)' },
  aposentadoria: { label: 'Aposentadoria', icon: Landmark, color: 'hsl(45 80% 50%)' },
  independencia_financeira: { label: 'Independência Financeira', icon: TrendingUp, color: 'hsl(160 78% 49%)' },
  outro: { label: 'Outro', icon: Star, color: 'hsl(207 25% 60%)' },
};

const CUSTOM_COLORS = [
  'hsl(340 65% 50%)', 'hsl(190 70% 45%)', 'hsl(120 50% 40%)',
  'hsl(260 55% 55%)', 'hsl(30 80% 50%)', 'hsl(170 60% 45%)',
];

const statusConfig: Record<DreamStatus, { label: string; color: string; bg: string }> = {
  em_progresso: { label: 'Em Progresso', color: 'hsl(210 60% 50%)', bg: 'hsl(210 60% 50% / 0.15)' },
  proximo: { label: 'Próximo de Realizar', color: 'hsl(160 78% 49%)', bg: 'hsl(160 78% 49% / 0.15)' },
  em_risco: { label: 'Em Risco', color: 'hsl(28 100% 63%)', bg: 'hsl(28 100% 63% / 0.15)' },
  concluido: { label: 'Concluído', color: 'hsl(160 78% 49%)', bg: 'hsl(160 78% 49% / 0.2)' },
};

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function MapaSonhos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDream, setEditingDream] = useState<Dream | null>(null);
  const [celebrationDream, setCelebrationDream] = useState<Dream | null>(null);
  const [suggestions, setSuggestions] = useState<{ dreamId: string; transactionDesc: string }[]>([]);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Build dynamic categoryConfig from dreams
  const categoryConfig = useMemo(() => {
    const config: Record<string, { label: string; icon: typeof Home; color: string }> = { ...defaultCategoryConfig };
    let customIdx = 0;
    dreams.forEach(d => {
      const displayCat = getDisplayCategory(d);
      if (!config[displayCat]) {
        config[displayCat] = {
          label: displayCat,
          icon: Star,
          color: CUSTOM_COLORS[customIdx % CUSTOM_COLORS.length],
        };
        customIdx++;
      }
    });
    return config;
  }, [dreams]);

  const getCfg = (dream: Dream) => {
    const displayCat = getDisplayCategory(dream);
    return categoryConfig[displayCat] || defaultCategoryConfig[dream.category] || { label: displayCat, icon: Star, color: 'hsl(207 25% 60%)' };
  };

  // Form state
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<DreamCategory>('outro');
  const [formValue, setFormValue] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formAccumulated, setFormAccumulated] = useState('');

  const fetchDreams = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('financial_dreams')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setDreams(data as Dream[]);
    setLoading(false);
  };

  const detectAchievements = async () => {
    if (!user || dreams.length === 0) return;
    const activeDreams = dreams.filter(d => d.status !== 'concluido');
    if (activeDreams.length === 0) return;

    const keywords: Record<string, string[]> = {
      casa_propria: ['casa', 'apartamento', 'imóvel', 'imovel', 'moradia'],
      carro: ['carro', 'veículo', 'veiculo', 'automóvel', 'automovel'],
      viagem: ['viagem', 'passagem', 'hotel', 'intercâmbio', 'intercambio', 'europa', 'disney'],
      cirurgia: ['cirurgia', 'procedimento', 'operação', 'operacao', 'hospital'],
      educacao: ['faculdade', 'universidade', 'curso', 'mba', 'pós-graduação', 'pos-graduacao'],
      aposentadoria: ['aposentadoria', 'previdência', 'previdencia'],
      independencia_financeira: ['independência', 'independencia', 'liberdade financeira'],
      outro: [],
    };

    const { data: txns } = await supabase
      .from('transactions')
      .select('amount, comment, category_id')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(200);

    if (!txns) return;
    const newSuggestions: typeof suggestions = [];

    for (const dream of activeDreams) {
      const kws = [...(keywords[dream.category] || []), ...dream.name.toLowerCase().split(' ')];
      for (const tx of txns) {
        const comment = (tx.comment || '').toLowerCase();
        const matchesKeyword = kws.some(k => comment.includes(k));
        const closeValue = Math.abs(tx.amount - dream.target_value) / dream.target_value < 0.15;
        if (matchesKeyword && closeValue) {
          newSuggestions.push({ dreamId: dream.id, transactionDesc: tx.comment || `R$ ${tx.amount}` });
          break;
        }
      }
    }
    setSuggestions(newSuggestions);
  };

  useEffect(() => { fetchDreams(); }, [user]);
  useEffect(() => { detectAchievements(); }, [dreams]);

  const resetForm = () => {
    setFormName(''); setFormCategory('outro'); setFormValue('');
    setFormDate(''); setFormDesc(''); setFormAccumulated('');
    setCustomCategoryName(''); setShowCustomInput(false);
    setEditingDream(null);
  };

  const openEdit = (dream: Dream) => {
    setEditingDream(dream);
    setFormName(dream.name);
    if (dream.custom_category) {
      setFormCategory('_custom');
      setCustomCategoryName(dream.custom_category);
      setShowCustomInput(true);
    } else {
      setFormCategory(dream.category);
      setCustomCategoryName('');
      setShowCustomInput(false);
    }
    setFormValue(String(dream.target_value));
    setFormDate(dream.target_date || '');
    setFormDesc(dream.description || '');
    setFormAccumulated(String(dream.accumulated_value));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!user || !formName || !formValue) return;
    if (formCategory === '_custom' && !customCategoryName.trim()) return;
    const target = Number(formValue);
    const accumulated = Number(formAccumulated || 0);
    const pct = target > 0 ? accumulated / target : 0;

    let status: DreamStatus = 'em_progresso';
    if (pct >= 1) status = 'concluido';
    else if (pct >= 0.75) status = 'proximo';
    else if (formDate && differenceInMonths(parseISO(formDate), new Date()) <= 2 && pct < 0.5) status = 'em_risco';

    const isCustom = formCategory === '_custom';
    const payload = {
      user_id: user.id,
      name: formName,
      category: isCustom ? 'outro' : formCategory,
      custom_category: isCustom ? customCategoryName.trim() : null,
      target_value: target,
      accumulated_value: accumulated,
      target_date: formDate || null,
      description: formDesc || null,
      status,
      completed_at: status === 'concluido' ? new Date().toISOString() : null,
    } as any;

    if (editingDream) {
      await supabase.from('financial_dreams').update(payload).eq('id', editingDream.id);
    } else {
      await supabase.from('financial_dreams').insert(payload);
    }

    if (status === 'concluido' && (!editingDream || editingDream.status !== 'concluido')) {
      setCelebrationDream({ ...editingDream!, ...payload } as Dream);
    }

    toast({ title: editingDream ? 'Sonho atualizado!' : 'Sonho criado!' });
    resetForm();
    setDialogOpen(false);
    fetchDreams();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('financial_dreams').delete().eq('id', id);
    toast({ title: 'Sonho removido.' });
    fetchDreams();
  };

  const markCompleted = async (dream: Dream) => {
    await supabase.from('financial_dreams').update({
      status: 'concluido' as DreamStatus,
      accumulated_value: dream.target_value,
      completed_at: new Date().toISOString(),
    }).eq('id', dream.id);
    setCelebrationDream(dream);
    setSuggestions(s => s.filter(sg => sg.dreamId !== dream.id));
    fetchDreams();
  };

  const completedCount = dreams.filter(d => d.status === 'concluido').length;
  const totalCount = dreams.length;

  const getRecommendation = (dream: Dream) => {
    if (dream.status === 'concluido' || !dream.target_date) return null;
    const remaining = dream.target_value - dream.accumulated_value;
    const months = Math.max(1, differenceInMonths(parseISO(dream.target_date), new Date()));
    const monthlyNeeded = remaining / months;
    return `Poupe ${fmt(monthlyNeeded)}/mês para alcançar esse sonho até ${format(parseISO(dream.target_date), "MMM 'de' yyyy", { locale: ptBR })}.`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Mapa de Sonhos Financeiros
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Transforme disciplina financeira em conquistas de vida.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Novo Sonho
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingDream ? 'Editar Sonho' : 'Criar Novo Sonho'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Nome do Sonho</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Viagem para Europa" />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select value={formCategory} onValueChange={v => {
                  if (v === '_custom') {
                    setShowCustomInput(true);
                    setFormCategory('_custom');
                  } else {
                    setShowCustomInput(false);
                    setCustomCategoryName('');
                    setFormCategory(v);
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(defaultCategoryConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                    <SelectItem value="_custom">+ Nova Categoria</SelectItem>
                  </SelectContent>
                </Select>
                {showCustomInput && (
                  <Input className="mt-2" value={customCategoryName} onChange={e => setCustomCategoryName(e.target.value)} placeholder="Nome da nova categoria" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor Necessário (R$)</Label>
                  <Input type="number" value={formValue} onChange={e => setFormValue(e.target.value)} placeholder="25000" />
                </div>
                <div>
                  <Label>Valor Acumulado (R$)</Label>
                  <Input type="number" value={formAccumulated} onChange={e => setFormAccumulated(e.target.value)} placeholder="0" />
                </div>
              </div>
              <div>
                <Label>Data Desejada</Label>
                <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>
              <div>
                <Label>Descrição / Observação</Label>
                <Textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Opcional" rows={2} />
              </div>
              <Button className="w-full" onClick={handleSave}>
                {editingDream ? 'Salvar Alterações' : 'Criar Sonho'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* General progress */}
      {totalCount > 0 && (
        <Card className="border-primary/20">
          <CardContent className="py-4 flex items-center gap-4">
            <Target className="h-8 w-8 text-primary flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Progresso dos Sonhos</p>
              <p className="text-muted-foreground text-xs">{completedCount} de {totalCount} sonhos realizados</p>
              <Progress value={totalCount > 0 ? (completedCount / totalCount) * 100 : 0} className="h-2 mt-2" />
            </div>
            <span className="text-2xl font-bold text-primary">{totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%</span>
          </CardContent>
        </Card>
      )}

      {/* Achievement suggestions */}
      <AnimatePresence>
        {suggestions.map(s => {
          const dream = dreams.find(d => d.id === s.dreamId);
          if (!dream) return null;
          return (
            <motion.div key={s.dreamId} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Card className="border-warning/40" style={{ background: 'hsl(28 100% 63% / 0.08)' }}>
                <CardContent className="py-3 flex items-center gap-3">
                  <Sparkles className="h-5 w-5 flex-shrink-0" style={{ color: 'hsl(28 100% 63%)' }} />
                  <div className="flex-1 text-sm">
                    <p className="text-foreground font-medium">
                      Parece que você realizou o sonho: <strong>{dream.name}</strong>
                    </p>
                    <p className="text-muted-foreground text-xs">Lançamento encontrado: "{s.transactionDesc}"</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => markCompleted(dream)} className="gap-1">
                    <Check className="h-3 w-3" /> Concluir
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Celebration modal */}
      <AnimatePresence>
        {celebrationDream && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setCelebrationDream(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
              className="rounded-2xl p-8 text-center max-w-sm mx-4"
              style={{ background: 'hsl(200 35% 12%)', border: '2px solid hsl(160 78% 49% / 0.4)' }}
              onClick={e => e.stopPropagation()}
            >
              <PartyPopper className="h-16 w-16 mx-auto text-primary mb-4" />
              <h2 className="text-2xl font-bold text-foreground mb-2">🎉 Parabéns!</h2>
              <p className="text-muted-foreground mb-1">Você realizou um sonho.</p>
              <p className="text-foreground font-semibold text-lg mb-1">{celebrationDream.name}</p>
              <p className="text-primary font-bold text-xl mb-4">{fmt(celebrationDream.target_value)}</p>
              <p className="text-muted-foreground text-sm italic mb-6">
                Disciplina financeira transforma sonhos em realidade.
              </p>
              <Button onClick={() => setCelebrationDream(null)}>Fechar</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dream cards */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : dreams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">Nenhum sonho cadastrado ainda.</p>
            <p className="text-muted-foreground text-sm">Clique em "Novo Sonho" para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {dreams.map((dream, i) => {
            const cfg = getCfg(dream);
            const Icon = cfg.icon;
            const pct = dream.target_value > 0 ? Math.min(100, (dream.accumulated_value / dream.target_value) * 100) : 0;
            const remaining = Math.max(0, dream.target_value - dream.accumulated_value);
            const monthsLeft = dream.target_date ? Math.max(0, differenceInMonths(parseISO(dream.target_date), new Date())) : null;
            const stCfg = statusConfig[dream.status];
            const recommendation = getRecommendation(dream);

            return (
              <motion.div
                key={dream.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="h-full relative overflow-hidden group hover:border-primary/30 transition-colors">
                  {/* Glow effect */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-lg" style={{ background: cfg.color }} />

                  <CardHeader className="pb-2 pt-4 px-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${cfg.color}20` }}>
                          <Icon className="h-4 w-4" style={{ color: cfg.color }} />
                        </div>
                        <div>
                          <CardTitle className="text-sm leading-tight">{dream.name}</CardTitle>
                          <span className="text-[11px] text-muted-foreground">{cfg.label}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-0" style={{ background: stCfg.bg, color: stCfg.color }}>
                        {stCfg.label}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 px-4 pb-4 pt-0">
                    {/* Values */}
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Necessário</p>
                        <p className="font-semibold text-foreground">{fmt(dream.target_value)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Acumulado</p>
                        <p className="font-semibold" style={{ color: cfg.color }}>{fmt(dream.accumulated_value)}</p>
                      </div>
                    </div>

                    {/* Progress */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] text-muted-foreground">Progresso</span>
                        <span className="text-xs font-bold" style={{ color: cfg.color }}>{Math.round(pct)}%</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'hsl(200 30% 16%)' }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: cfg.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, delay: i * 0.1 }}
                        />
                      </div>
                    </div>

                    {/* Extra info */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {remaining > 0 && (
                        <span>Faltam {fmt(remaining)}</span>
                      )}
                      {monthsLeft !== null && monthsLeft > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {monthsLeft} {monthsLeft === 1 ? 'mês' : 'meses'}
                        </span>
                      )}
                    </div>

                    {/* Recommendation */}
                    {recommendation && dream.status !== 'concluido' && (
                      <div className="text-xs rounded-lg p-2.5 flex items-start gap-2" style={{ background: 'hsl(160 78% 49% / 0.06)' }}>
                        <Sparkles className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{recommendation}</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="ghost" className="flex-1 text-xs h-8" onClick={() => openEdit(dream)}>
                        <Edit2 className="h-3 w-3 mr-1" /> Editar
                      </Button>
                      {dream.status !== 'concluido' && (
                        <Button size="sm" variant="ghost" className="flex-1 text-xs h-8 text-primary" onClick={() => markCompleted(dream)}>
                          <Check className="h-3 w-3 mr-1" /> Concluir
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDelete(dream.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
