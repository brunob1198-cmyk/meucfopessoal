import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAssets, useLiabilities } from '@/hooks/useBalanceSheet';
import { useDREIntegration } from '@/hooks/useDREIntegration';
import { formatBRL } from '@/lib/dre';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, ReferenceLine
} from 'recharts';
import {
  TrendingUp, Target, Calculator, Lightbulb, DollarSign, Wallet,
  PiggyBank, BarChart3, Plus, Trash2, AlertTriangle, CheckCircle2, Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Scenario {
  id: string;
  name: string;
  color: string;
  currentAge: number;
  targetAge: number;
  returnRate: number;
  currentInvestment: number;
  monthlyInvestment: number;
  incomeGrowth: number;
  expenseGrowth: number;
}

interface FinancialEvent {
  id: string;
  type: 'imovel' | 'veiculo' | 'aumento_despesas' | 'aumento_renda';
  label: string;
  amount: number;
  yearFromNow: number;
  monthlyImpact: number;
}

const EVENT_LABELS: Record<string, string> = {
  imovel: 'Compra de Imóvel',
  veiculo: 'Compra de Veículo',
  aumento_despesas: 'Aumento de Despesas',
  aumento_renda: 'Aumento de Renda',
};

const SCENARIO_COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444'];

function computeProjection(
  scenario: Scenario,
  monthlyIncome: number,
  monthlyExpenses: number,
  events: FinancialEvent[],
  years: number = 30
) {
  const data: { year: number; patrimonio: number; renda: number; despesas: number; investido: number }[] = [];
  let patrimonio = scenario.currentInvestment;
  let renda = monthlyIncome;
  let despesas = monthlyExpenses;
  let totalInvestido = scenario.currentInvestment;

  for (let y = 0; y <= years; y++) {
    // Apply events for this year
    const yearEvents = events.filter(e => e.yearFromNow === y);
    for (const ev of yearEvents) {
      if (ev.type === 'imovel' || ev.type === 'veiculo') {
        patrimonio -= ev.amount;
        despesas += ev.monthlyImpact;
      } else if (ev.type === 'aumento_despesas') {
        despesas += ev.monthlyImpact;
      } else if (ev.type === 'aumento_renda') {
        renda += ev.monthlyImpact;
      }
    }

    data.push({
      year: new Date().getFullYear() + y,
      patrimonio: Math.round(patrimonio),
      renda: Math.round(renda * 12),
      despesas: Math.round(despesas * 12),
      investido: Math.round(totalInvestido),
    });

    if (y < years) {
      // Monthly compounding for the year
      const monthlyRate = scenario.returnRate / 100 / 12;
      for (let m = 0; m < 12; m++) {
        patrimonio = patrimonio * (1 + monthlyRate) + scenario.monthlyInvestment;
        totalInvestido += scenario.monthlyInvestment;
      }
      // Annual growth
      renda *= (1 + scenario.incomeGrowth / 100);
      despesas *= (1 + scenario.expenseGrowth / 100);
    }
  }

  return data;
}

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}K`;
  return formatBRL(value);
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="flex justify-between gap-4">
          <span>{p.name}:</span>
          <span className="font-medium tabular-nums">{formatBRL(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

export default function SimuladorFinanceiro() {
  const { data: assets = [] } = useAssets();
  const { data: liabilities = [] } = useLiabilities();
  const dreData = useDREIntegration();

  // Computed current data
  const totalAssets = assets.reduce((s, a) => s + Number(a.current_value), 0);
  const totalLiabilities = liabilities.reduce((s, l) => s + Number(l.current_balance), 0);
  const netWorth = totalAssets - totalLiabilities;

  const avgMonthlyIncome = useMemo(() => {
    const profits = dreData.monthlyProfits.filter(p => p.receita > 0);
    return profits.length > 0 ? profits.reduce((s, p) => s + p.receita, 0) / profits.length : 0;
  }, [dreData.monthlyProfits]);

  const avgMonthlyExpenses = useMemo(() => {
    const profits = dreData.monthlyProfits.filter(p => p.despesas > 0);
    return profits.length > 0 ? profits.reduce((s, p) => s + p.despesas, 0) / profits.length : 0;
  }, [dreData.monthlyProfits]);

  const avgMonthlySavings = avgMonthlyIncome - avgMonthlyExpenses;

  // Scenarios
  const [scenarios, setScenarios] = useState<Scenario[]>([
    {
      id: '1',
      name: 'Cenário Atual',
      color: SCENARIO_COLORS[0],
      currentAge: 30,
      targetAge: 55,
      returnRate: 8,
      currentInvestment: Math.max(netWorth, 0),
      monthlyInvestment: Math.max(avgMonthlySavings, 0),
      incomeGrowth: 3,
      expenseGrowth: 4,
    },
  ]);

  const [activeScenario, setActiveScenario] = useState('1');
  const scenario = scenarios.find(s => s.id === activeScenario) || scenarios[0];

  // Financial events
  const [events, setEvents] = useState<FinancialEvent[]>([]);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<FinancialEvent>>({ type: 'imovel', yearFromNow: 5, amount: 0, monthlyImpact: 0 });

  const updateScenario = useCallback((field: keyof Scenario, value: any) => {
    setScenarios(prev => prev.map(s => s.id === activeScenario ? { ...s, [field]: value } : s));
  }, [activeScenario]);

  const addScenario = () => {
    const id = String(Date.now());
    const names = ['Cenário Otimizado', 'Cenário Agressivo', 'Cenário Conservador'];
    const idx = scenarios.length;
    setScenarios(prev => [...prev, {
      ...scenario,
      id,
      name: names[idx - 1] || `Cenário ${idx + 1}`,
      color: SCENARIO_COLORS[idx % SCENARIO_COLORS.length],
      monthlyInvestment: scenario.monthlyInvestment * 1.5,
      returnRate: scenario.returnRate + 2,
    }]);
    setActiveScenario(id);
  };

  const removeScenario = (id: string) => {
    if (scenarios.length <= 1) return;
    setScenarios(prev => prev.filter(s => s.id !== id));
    if (activeScenario === id) setActiveScenario(scenarios[0].id);
  };

  const addEvent = () => {
    if (!newEvent.type || !newEvent.amount) return;
    setEvents(prev => [...prev, {
      id: String(Date.now()),
      type: newEvent.type as any,
      label: EVENT_LABELS[newEvent.type!],
      amount: newEvent.amount || 0,
      yearFromNow: newEvent.yearFromNow || 5,
      monthlyImpact: newEvent.monthlyImpact || 0,
    }]);
    setShowEventDialog(false);
    setNewEvent({ type: 'imovel', yearFromNow: 5, amount: 0, monthlyImpact: 0 });
  };

  // Projections
  const projections = useMemo(() => {
    return scenarios.map(s => ({
      scenario: s,
      data: computeProjection(s, avgMonthlyIncome, avgMonthlyExpenses, events),
    }));
  }, [scenarios, avgMonthlyIncome, avgMonthlyExpenses, events]);

  const activeProjection = projections.find(p => p.scenario.id === activeScenario) || projections[0];

  // Independence calculation (4% rule)
  const annualExpenses = avgMonthlyExpenses * 12 * Math.pow(1 + scenario.expenseGrowth / 100, 10);
  const independenceTarget = annualExpenses / 0.04;
  const independenceYear = useMemo(() => {
    const data = activeProjection?.data || [];
    const idx = data.findIndex(d => d.patrimonio >= independenceTarget);
    return idx >= 0 ? data[idx].year : null;
  }, [activeProjection, independenceTarget]);

  // Milestones
  const milestones = useMemo(() => {
    const data = activeProjection?.data || [];
    const currentYear = new Date().getFullYear();
    return [5, 10, 20, 30].map(y => {
      const point = data.find(d => d.year === currentYear + y);
      return { years: y, year: currentYear + y, patrimonio: point?.patrimonio || 0 };
    });
  }, [activeProjection]);

  // Insights
  const insights = useMemo(() => {
    const msgs: { icon: typeof Lightbulb; text: string; type: 'info' | 'warning' | 'success' }[] = [];
    const data20 = activeProjection?.data.find(d => d.year === new Date().getFullYear() + 20);

    // Insight 1: +500 monthly
    if (data20) {
      const altScenario = { ...scenario, monthlyInvestment: scenario.monthlyInvestment + 500 };
      const altData = computeProjection(altScenario, avgMonthlyIncome, avgMonthlyExpenses, events);
      const altData20 = altData.find(d => d.year === new Date().getFullYear() + 20);
      if (altData20) {
        const diff = altData20.patrimonio - data20.patrimonio;
        msgs.push({
          icon: Lightbulb,
          text: `Se você aumentar seus investimentos mensais em R$ 500, seu patrimônio em 20 anos aumenta em aproximadamente ${formatBRL(diff)}.`,
          type: 'info',
        });
      }
    }

    // Insight 2: expense growth
    if (scenario.expenseGrowth > scenario.incomeGrowth) {
      msgs.push({
        icon: AlertTriangle,
        text: `Suas despesas crescem mais rápido (${scenario.expenseGrowth}%) que sua renda (${scenario.incomeGrowth}%). Isso pode comprometer sua independência financeira.`,
        type: 'warning',
      });
    }

    // Insight 3: independence
    if (independenceYear) {
      msgs.push({
        icon: CheckCircle2,
        text: `Com o cenário atual, você pode atingir independência financeira em ${independenceYear}, aos ${scenario.currentAge + (independenceYear - new Date().getFullYear())} anos.`,
        type: 'success',
      });
    } else {
      msgs.push({
        icon: Clock,
        text: `No cenário atual, a independência financeira não é atingida em 30 anos. Considere aumentar investimentos ou reduzir despesas.`,
        type: 'warning',
      });
    }

    return msgs;
  }, [activeProjection, scenario, independenceTarget, independenceYear, avgMonthlyIncome, avgMonthlyExpenses, events]);

  // Chart data for comparison
  const comparisonData = useMemo(() => {
    if (projections.length === 0) return [];
    const baseData = projections[0].data;
    return baseData.map((d, i) => {
      const point: any = { year: d.year };
      projections.forEach(p => {
        point[p.scenario.name] = p.data[i]?.patrimonio || 0;
      });
      if (independenceTarget > 0) {
        point['Meta Independência'] = independenceTarget;
      }
      return point;
    });
  }, [projections, independenceTarget]);

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Calculator className="h-7 w-7 text-primary" />
            Simulador Financeiro
          </h1>
          <p className="text-muted-foreground mt-1">Projete sua evolução patrimonial e planeje sua independência financeira</p>
        </div>
      </div>

      {/* BLOCO 1 — Dados Atuais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-primary mb-1">
              <Wallet className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Patrimônio Líquido</span>
            </div>
            <p className="text-xl font-bold tabular-nums">{formatBRL(netWorth)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <DollarSign className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Renda Média</span>
            </div>
            <p className="text-xl font-bold tabular-nums">{formatBRL(avgMonthlyIncome)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-rose-500/10 to-rose-500/5 border-rose-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-rose-600 mb-1">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Despesas Médias</span>
            </div>
            <p className="text-xl font-bold tabular-nums">{formatBRL(avgMonthlyExpenses)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <PiggyBank className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Poupança Média</span>
            </div>
            <p className={cn('text-xl font-bold tabular-nums', avgMonthlySavings < 0 && 'text-destructive')}>
              {formatBRL(avgMonthlySavings)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* BLOCO 2 — Configuração de Cenários */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Configuração de Cenários
            </CardTitle>
            <Button variant="outline" size="sm" onClick={addScenario} disabled={scenarios.length >= 4} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> Novo Cenário
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Scenario tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {scenarios.map(s => (
              <div key={s.id} className="flex items-center gap-1">
                <Button
                  variant={activeScenario === s.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveScenario(s.id)}
                  className="gap-1.5"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.name}
                </Button>
                {scenarios.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeScenario(s.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Nome do Cenário</Label>
                <Input value={scenario.name} onChange={e => updateScenario('name', e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Idade Atual: {scenario.currentAge} anos</Label>
                <Slider value={[scenario.currentAge]} onValueChange={([v]) => updateScenario('currentAge', v)} min={18} max={70} step={1} className="mt-2" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Idade Alvo: {scenario.targetAge} anos</Label>
                <Slider value={[scenario.targetAge]} onValueChange={([v]) => updateScenario('targetAge', v)} min={scenario.currentAge + 5} max={90} step={1} className="mt-2" />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Retorno Anual: {scenario.returnRate}%</Label>
                <Slider value={[scenario.returnRate]} onValueChange={([v]) => updateScenario('returnRate', v)} min={2} max={20} step={0.5} className="mt-2" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Patrimônio Investido Atual</Label>
                <Input type="number" value={scenario.currentInvestment} onChange={e => updateScenario('currentInvestment', Number(e.target.value))} className="mt-1" />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Investimento Mensal</Label>
                <Input type="number" value={scenario.monthlyInvestment} onChange={e => updateScenario('monthlyInvestment', Number(e.target.value))} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Crescimento da Renda: {scenario.incomeGrowth}% a.a.</Label>
                <Slider value={[scenario.incomeGrowth]} onValueChange={([v]) => updateScenario('incomeGrowth', v)} min={0} max={15} step={0.5} className="mt-2" />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Crescimento das Despesas: {scenario.expenseGrowth}% a.a.</Label>
                <Slider value={[scenario.expenseGrowth]} onValueChange={([v]) => updateScenario('expenseGrowth', v)} min={0} max={15} step={0.5} className="mt-2" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Impacto de Decisões */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Impacto de Decisões Financeiras
            </CardTitle>
            <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Simular Evento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Simular Evento Financeiro</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Tipo de Evento</Label>
                    <Select value={newEvent.type} onValueChange={v => setNewEvent(prev => ({ ...prev, type: v as any }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="imovel">Compra de Imóvel</SelectItem>
                        <SelectItem value="veiculo">Compra de Veículo</SelectItem>
                        <SelectItem value="aumento_despesas">Aumento de Despesas</SelectItem>
                        <SelectItem value="aumento_renda">Aumento de Renda</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Valor Total (R$)</Label>
                    <Input type="number" value={newEvent.amount || ''} onChange={e => setNewEvent(prev => ({ ...prev, amount: Number(e.target.value) }))} className="mt-1" />
                  </div>
                  <div>
                    <Label>Impacto Mensal (R$)</Label>
                    <Input type="number" value={newEvent.monthlyImpact || ''} onChange={e => setNewEvent(prev => ({ ...prev, monthlyImpact: Number(e.target.value) }))} className="mt-1" placeholder="Ex: parcela mensal, aumento salarial..." />
                  </div>
                  <div>
                    <Label>Em quantos anos a partir de agora?</Label>
                    <Input type="number" value={newEvent.yearFromNow || ''} onChange={e => setNewEvent(prev => ({ ...prev, yearFromNow: Number(e.target.value) }))} className="mt-1" />
                  </div>
                  <Button onClick={addEvent} className="w-full">Adicionar Evento</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum evento simulado. Adicione eventos para ver o impacto na sua projeção.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {events.map(ev => (
                <Badge key={ev.id} variant="secondary" className="gap-1.5 py-1.5 px-3">
                  {ev.label} — {formatBRL(ev.amount)} em {ev.yearFromNow} anos
                  <button onClick={() => setEvents(prev => prev.filter(e => e.id !== ev.id))} className="ml-1 hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* BLOCO 3 — Projeção */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Milestones */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Marcos Patrimoniais</h3>
          {milestones.map(m => (
            <Card key={m.years} className="border-border/50">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Em {m.years} anos ({m.year})</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Idade: {scenario.currentAge + m.years}</p>
                </div>
                <p className={cn('text-lg font-bold tabular-nums', m.patrimonio >= 0 ? 'text-primary' : 'text-destructive')}>
                  {formatCompact(m.patrimonio)}
                </p>
              </CardContent>
            </Card>
          ))}

          {/* Independence card */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">Independência Financeira</span>
              </div>
              <p className="text-xs text-muted-foreground">Meta (regra dos 4%)</p>
              <p className="text-lg font-bold tabular-nums">{formatBRL(independenceTarget)}</p>
              <div className="mt-2 pt-2 border-t border-primary/20">
                {independenceYear ? (
                  <p className="text-sm font-medium text-emerald-600">
                    ✓ Atingível em {independenceYear} (aos {scenario.currentAge + (independenceYear - new Date().getFullYear())} anos)
                  </p>
                ) : (
                  <p className="text-sm font-medium text-amber-600">
                    ⚠ Não atingível em 30 anos no cenário atual
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main chart */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Evolução Patrimonial Projetada</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="comparison">
                <TabsList className="mb-4">
                  <TabsTrigger value="comparison">Comparação</TabsTrigger>
                  <TabsTrigger value="detail">Detalhado</TabsTrigger>
                </TabsList>
                <TabsContent value="comparison">
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={v => formatCompact(v)} tick={{ fontSize: 11 }} width={80} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      {scenarios.map(s => (
                        <Line
                          key={s.id}
                          type="monotone"
                          dataKey={s.name}
                          stroke={s.color}
                          strokeWidth={activeScenario === s.id ? 3 : 1.5}
                          dot={false}
                          opacity={activeScenario === s.id ? 1 : 0.5}
                        />
                      ))}
                      {independenceTarget > 0 && (
                        <ReferenceLine
                          y={independenceTarget}
                          stroke="hsl(var(--destructive))"
                          strokeDasharray="6 4"
                          label={{ value: 'Meta IF', position: 'right', fontSize: 11 }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </TabsContent>
                <TabsContent value="detail">
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={activeProjection?.data || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={v => formatCompact(v)} tick={{ fontSize: 11 }} width={80} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area type="monotone" dataKey="patrimonio" name="Patrimônio" fill="hsl(var(--primary) / 0.2)" stroke="hsl(var(--primary))" strokeWidth={2} />
                      <Area type="monotone" dataKey="investido" name="Total Investido" fill="hsl(var(--muted) / 0.3)" stroke="hsl(var(--muted-foreground))" strokeWidth={1} strokeDasharray="4 4" />
                    </AreaChart>
                  </ResponsiveContainer>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Insights */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Insights Automáticos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.map((insight, i) => (
            <div
              key={i}
              className={cn(
                'flex items-start gap-3 rounded-lg p-3 text-sm',
                insight.type === 'info' && 'bg-primary/5 text-primary',
                insight.type === 'warning' && 'bg-amber-500/10 text-amber-700',
                insight.type === 'success' && 'bg-emerald-500/10 text-emerald-700',
              )}
            >
              <insight.icon className="h-5 w-5 mt-0.5 shrink-0" />
              <p>{insight.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
