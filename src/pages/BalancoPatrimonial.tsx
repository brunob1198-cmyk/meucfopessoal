import { useState, useMemo, useEffect } from 'react';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import {
  Plus, Trash2, Edit2, TrendingUp, TrendingDown, Minus,
  Landmark, CreditCard, PiggyBank, ChevronDown, ChevronRight, Save, Wallet, ArrowUpRight, AlertTriangle, ShieldAlert,
  Gem, Wallet as WalletIcon, BarChart3, PiggyBank as PiggyBankIcon, Lightbulb
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Area, AreaChart, BarChart, Bar, Legend, ComposedChart, PieChart, Pie, Cell 
} from 'recharts';
import {
  useAssets, useLiabilities, useNetWorthHistory,
  ASSET_CATEGORY_LABELS, LIABILITY_CATEGORY_LABELS,
  ASSET_GROUPS, LIABILITY_GROUPS,
  type Asset, type Liability, type AssetCategory, type LiabilityCategory
} from '@/hooks/useBalanceSheet';
import { useDREIntegration } from '@/hooks/useDREIntegration';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { formatBRL } from '@/lib/dre';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const COLORS = [
  'hsl(160, 50%, 40%)', 'hsl(220, 50%, 45%)', 'hsl(38, 55%, 45%)',
  'hsl(280, 40%, 45%)', 'hsl(0, 45%, 42%)', 'hsl(180, 40%, 38%)',
];

const cardVariant = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' as const }
  })
};

const tooltipStyle = {
  contentStyle: {
    background: 'hsl(200 35% 12% / 0.95)',
    border: '1px solid hsl(200 25% 20%)',
    borderRadius: '8px',
    backdropFilter: 'blur(8px)',
    color: 'hsl(var(--foreground))'
  },
  labelStyle: { color: 'hsl(var(--foreground))' },
  itemStyle: { color: 'hsl(var(--foreground))' }
};

// Group asset categories for composition
const COMPOSITION_GROUPS: Record<string, string[]> = {
  'Investimentos': ['renda_fixa', 'acoes', 'fundos', 'criptomoedas'],
  'Imóveis': ['imoveis'],
  'Caixa': ['conta_corrente', 'poupanca', 'dinheiro_caixa'],
  'Veículos': ['veiculos'],
  'Outros': ['participacoes', 'outros_bens'],
};

function AssetForm({ asset, onSave, onClose }: { asset?: Asset; onSave: (a: any) => void; onClose: () => void }) {
  const [name, setName] = useState(asset?.name ?? '');
  const [category, setCategory] = useState<AssetCategory>(asset?.category ?? 'conta_corrente');
  const [value, setValue] = useState(asset?.current_value?.toString() ?? '');
  const [date, setDate] = useState(asset?.acquisition_date ?? '');
  const [notes, setNotes] = useState(asset?.notes ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...(asset?.id ? { id: asset.id } : {}),
      name,
      category,
      current_value: parseFloat(value) || 0,
      acquisition_date: date || null,
      notes: notes || null,
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Nome do Ativo</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Apartamento Centro" required />
      </div>
      <div>
        <Label>Categoria</Label>
        <Select value={category} onValueChange={v => setCategory(v as AssetCategory)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(ASSET_CATEGORY_LABELS).map(([k, l]) => (
              <SelectItem key={k} value={k}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Valor Atual (R$)</Label>
        <Input type="number" step="0.01" value={value} onChange={e => setValue(e.target.value)} required />
      </div>
      <div>
        <Label>Data de Aquisição</Label>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </div>
      <div>
        <Label>Observação</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit"><Save className="h-4 w-4 mr-1" />Salvar</Button>
      </div>
    </form>
  );
}

function LiabilityForm({ liability, onSave, onClose }: { liability?: Liability; onSave: (l: any) => void; onClose: () => void }) {
  const [name, setName] = useState(liability?.name ?? '');
  const [category, setCategory] = useState<LiabilityCategory>(liability?.category ?? 'cartao_credito');
  const [totalValue, setTotalValue] = useState(liability?.total_value?.toString() ?? '');
  const [currentBalance, setCurrentBalance] = useState(liability?.current_balance?.toString() ?? '');
  const [monthlyPayment, setMonthlyPayment] = useState(liability?.monthly_payment?.toString() ?? '0');
  const [interestRate, setInterestRate] = useState(liability?.interest_rate?.toString() ?? '0');
  const [startDate, setStartDate] = useState(liability?.start_date ?? '');
  const [endDate, setEndDate] = useState(liability?.end_date ?? '');
  const [notes, setNotes] = useState(liability?.notes ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...(liability?.id ? { id: liability.id } : {}),
      name,
      category,
      total_value: parseFloat(totalValue) || 0,
      current_balance: parseFloat(currentBalance) || 0,
      monthly_payment: parseFloat(monthlyPayment) || 0,
      interest_rate: parseFloat(interestRate) || 0,
      start_date: startDate || null,
      end_date: endDate || null,
      notes: notes || null,
    });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Nome da Dívida</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Financiamento Apto" required />
      </div>
      <div>
        <Label>Categoria</Label>
        <Select value={category} onValueChange={v => setCategory(v as LiabilityCategory)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(LIABILITY_CATEGORY_LABELS).map(([k, l]) => (
              <SelectItem key={k} value={k}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Valor Total (R$)</Label>
          <Input type="number" step="0.01" value={totalValue} onChange={e => setTotalValue(e.target.value)} required />
        </div>
        <div>
          <Label>Saldo Atual (R$)</Label>
          <Input type="number" step="0.01" value={currentBalance} onChange={e => setCurrentBalance(e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Parcela Mensal (R$)</Label>
          <Input type="number" step="0.01" value={monthlyPayment} onChange={e => setMonthlyPayment(e.target.value)} />
        </div>
        <div>
          <Label>Taxa de Juros (% a.m.)</Label>
          <Input type="number" step="0.01" value={interestRate} onChange={e => setInterestRate(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Data de Início</Label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div>
          <Label>Data Final</Label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Observação</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
        <Button type="submit"><Save className="h-4 w-4 mr-1" />Salvar</Button>
      </div>
    </form>
  );
}

function SummaryCard({ title, value, icon: Icon, trend, trendLabel, variant }: {
  title: string; value: number; icon: any; trend?: number; trendLabel?: string;
  variant: 'success' | 'destructive' | 'primary';
}) {
  const colorMap = {
    success: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400',
    destructive: 'text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400',
    primary: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400',
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className={cn('p-2 rounded-lg', colorMap[variant])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="text-2xl font-bold">{fmt(value)}</p>
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-1 text-xs">
            {trend >= 0 ? <TrendingUp className="h-3 w-3 text-emerald-500" /> : <TrendingDown className="h-3 w-3 text-red-500" />}
            <span className={trend >= 0 ? 'text-emerald-600' : 'text-red-600'}>
              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
            </span>
            {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GroupedTable<T extends { id: string; category: string; name: string }>({
  items, groups, categoryLabels, valueKey, onEdit, onDelete,
}: {
  items: T[];
  groups: Record<string, string[]>;
  categoryLabels: Record<string, string>;
  valueKey: keyof T;
  onEdit: (item: T) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(Object.keys(groups).map(g => [g, true]))
  );

  const toggle = (g: string) => setExpanded(p => ({ ...p, [g]: !p[g] }));

  return (
    <div className="space-y-1">
      {Object.entries(groups).map(([groupName, cats]) => {
        const groupItems = items.filter(i => (cats as string[]).includes(i.category));
        const groupTotal = groupItems.reduce((s, i) => s + Number(i[valueKey] || 0), 0);
        if (groupItems.length === 0 && !expanded[groupName]) return null;

        return (
          <div key={groupName}>
            <button
              onClick={() => toggle(groupName)}
              className="w-full flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {expanded[groupName] ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                <span className="font-semibold text-sm">{groupName}</span>
                <span className="text-xs text-muted-foreground">({groupItems.length})</span>
              </div>
              <span className="font-semibold text-sm">{fmt(groupTotal)}</span>
            </button>
            {expanded[groupName] && groupItems.map(item => (
              <div key={item.id} className="flex items-center justify-between py-1.5 px-3 pl-10 hover:bg-muted/30 rounded transition-colors">
                <div>
                  <span className="text-sm">{item.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">({categoryLabels[item.category]})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{fmt(Number(item[valueKey] || 0))}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(item.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function BalancoPatrimonial() {
  const { data: assets = [], upsert: upsertAsset, remove: removeAsset } = useAssets();
  const { data: liabilities = [], upsert: upsertLiability, remove: removeLiability } = useLiabilities();
  const { data: history = [], saveSnapshot } = useNetWorthHistory();
  const {
    currentMonthProfit,
    previousMonthProfit,
    yearToDateProfit,
    accumulatedProfit,
    monthlyProfits,
    isLoading: dreLoading,
  } = useDREIntegration();

  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [liabilityDialogOpen, setLiabilityDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | undefined>();
  const [editingLiability, setEditingLiability] = useState<Liability | undefined>();

  const totalAssets = useMemo(() => assets.reduce((s, a) => s + Number(a.current_value), 0), [assets]);
  const totalLiabilities = useMemo(() => liabilities.reduce((s, l) => s + Number(l.current_balance), 0), [liabilities]);
  
  // Net worth now includes accumulated DRE profit (lucros retidos)
  const netWorthBase = totalAssets - totalLiabilities;
  const netWorth = netWorthBase + accumulatedProfit;

  // Calculate trends from history
  const monthlyTrend = useMemo(() => {
    if (history.length < 2) return undefined;
    const prev = Number(history[history.length - 2].net_worth);
    if (prev === 0) return undefined;
    return ((netWorth - prev) / Math.abs(prev)) * 100;
  }, [history, netWorth]);

  // Auto-save snapshot for current month
  useEffect(() => {
    if (assets.length > 0 || liabilities.length > 0 || accumulatedProfit !== 0) {
      const currentMonth = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      saveSnapshot.mutate({
        month: currentMonth,
        total_assets: totalAssets,
        total_liabilities: totalLiabilities,
        net_worth: netWorth,
      });
    }
  }, [totalAssets, totalLiabilities, accumulatedProfit]);

  const chartData = useMemo(() => {
    const historyData = history.map(h => ({
      month: format(new Date(h.month), 'MMM/yy', { locale: ptBR }),
      ativos: Number(h.total_assets),
      passivos: Number(h.total_liabilities),
      patrimonio: Number(h.net_worth),
    }));
    const currentMonth = format(startOfMonth(new Date()), 'MMM/yy', { locale: ptBR });
    if (!historyData.find(d => d.month === currentMonth)) {
      historyData.push({ month: currentMonth, ativos: totalAssets, passivos: totalLiabilities, patrimonio: netWorth });
    }
    return historyData;
  }, [history, totalAssets, totalLiabilities, netWorth]);

  const profitChartData = useMemo(() => {
    return monthlyProfits.map(p => ({
      month: format(new Date(p.month + '-01'), 'MMM/yy', { locale: ptBR }),
      lucro: p.lucroLiquido,
      receita: p.receita,
      despesas: p.despesas,
    }));
  }, [monthlyProfits]);

  // Mapa de Riqueza Merged Logic
  const growth12m = useMemo(() => {
    if (history.length < 2) return null;
    const sorted = [...history].sort((a, b) => a.month.localeCompare(b.month));
    const latest = sorted[sorted.length - 1];
    const yearAgo = sorted.find(s => {
      const d = new Date(s.month);
      const l = new Date(latest.month);
      return l.getFullYear() - d.getFullYear() === 1 && l.getMonth() === d.getMonth();
    }) || sorted[0];
    return Number(latest.net_worth) - Number(yearAgo.net_worth);
  }, [history]);

  const compositionData = useMemo(() => {
    return Object.entries(COMPOSITION_GROUPS).map(([label, cats]) => {
      const value = assets
        .filter(a => cats.includes(a.category))
        .reduce((s, a) => s + Number(a.current_value), 0);
      return { name: label, value };
    }).filter(d => d.value > 0);
  }, [assets]);

  const evolutionData = useMemo(() => {
    return [...history]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(s => ({
        month: new Date(s.month).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        patrimonio: Number(s.net_worth),
        ativos: Number(s.total_assets),
        passivos: Number(s.total_liabilities),
      }));
  }, [history]);

  const avgMonthlySavings = useMemo(() => {
    const profits = monthlyProfits.filter(p => p.receita > 0);
    if (profits.length === 0) return 0;
    return profits.reduce((s, p) => s + (p.receita - p.despesas), 0) / profits.length;
  }, [monthlyProfits]);

  const annualSavings = avgMonthlySavings * 12;
  const totalGrowth = growth12m || 0;
  const investmentReturns = Math.max(0, totalGrowth - annualSavings) * 0.7;
  const assetAppreciation = Math.max(0, totalGrowth - annualSavings - investmentReturns);

  const growthDrivers = [
    { name: 'Poupança', value: Math.max(0, annualSavings), color: 'hsl(160, 50%, 40%)' },
    { name: 'Retorno Investimentos', value: Math.max(0, investmentReturns), color: 'hsl(220, 50%, 45%)' },
    { name: 'Valorização de Ativos', value: Math.max(0, assetAppreciation), color: 'hsl(38, 55%, 45%)' },
  ];

  const avgMonthlyIncome = useMemo(() => {
    const profits = monthlyProfits.filter(p => p.receita > 0);
    return profits.length > 0 ? profits.reduce((s, p) => s + p.receita, 0) / profits.length : 0;
  }, [monthlyProfits]);

  const savingsRate = avgMonthlyIncome > 0 ? (avgMonthlySavings / avgMonthlyIncome) * 100 : 0;
  const wealthToIncomeYears = avgMonthlyIncome > 0 ? netWorth / (avgMonthlyIncome * 12) : 0;
  const growthRate = growth12m !== null && netWorth > 0 ? (growth12m / (netWorth - growth12m)) * 100 : 0;

  const riquezaInsights = useMemo(() => {
    const msgs: string[] = [];
    if (growth12m !== null && growth12m > 0 && netWorth > 0) {
      msgs.push(`Seu patrimônio cresceu ${growthRate.toFixed(0)}% no último ano.`);
    }
    if (annualSavings > 0 && totalGrowth > 0) {
      const poupancaPct = (annualSavings / totalGrowth) * 100;
      msgs.push(`${Math.min(100, poupancaPct).toFixed(0)}% do crescimento veio da sua poupança.`);
    }
    const investPct = totalAssets > 0
      ? (assets.filter(a => ['renda_fixa', 'acoes', 'fundos', 'criptomoedas'].includes(a.category))
          .reduce((s, a) => s + Number(a.current_value), 0) / totalAssets) * 100
      : 0;
    if (investPct > 0) {
      msgs.push(`Seus investimentos representam ${investPct.toFixed(0)}% do seu patrimônio.`);
    }
    if (savingsRate >= 20) {
      msgs.push('Sua taxa de poupança está acima da média. Continue assim!');
    } else if (savingsRate > 0) {
      msgs.push(`Sua taxa de poupança é ${savingsRate.toFixed(0)}%. Tente aumentar para 20%+..`);
    }
    return msgs;
  }, [growth12m, growthRate, annualSavings, totalGrowth, totalAssets, assets, savingsRate, netWorth]);



  // Alert: passivos > ativos
  const isPassivosExceedAtivos = totalLiabilities > totalAssets;

  // Alert: 3 consecutive months of declining net worth
  const isDeclineTrend = useMemo(() => {
    if (history.length < 3) return false;
    const last3 = history.slice(-3);
    return (
      Number(last3[2].net_worth) < Number(last3[1].net_worth) &&
      Number(last3[1].net_worth) < Number(last3[0].net_worth)
    );
  }, [history]);

  const hasAlerts = isPassivosExceedAtivos || isDeclineTrend;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Balanço Patrimonial</h1>
          <p className="text-muted-foreground text-sm">Visão completa da sua posição financeira</p>
        </div>
      </div>

      {/* Alerts */}
      {hasAlerts && (
        <div className="space-y-3">
          {isPassivosExceedAtivos && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40">
              <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm text-red-700 dark:text-red-300">Passivos superam os Ativos</p>
                <p className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
                  Seus passivos ({fmt(totalLiabilities)}) estão maiores que seus ativos ({fmt(totalAssets)}).
                  Isso significa patrimônio líquido negativo — priorize a redução de dívidas.
                </p>
              </div>
            </div>
          )}
          {isDeclineTrend && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-sm text-amber-700 dark:text-amber-300">Patrimônio em queda há 3 meses</p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                  Seu patrimônio líquido está em queda consecutiva nos últimos 3 meses.
                  Revise seus gastos e considere estratégias para reverter essa tendência.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard
          title="Total de Ativos"
          value={totalAssets}
          icon={PiggyBank}
          variant="success"
        />
        <SummaryCard
          title="Total de Passivos"
          value={totalLiabilities}
          icon={CreditCard}
          variant="destructive"
        />
        <SummaryCard
          title="Patrimônio Líquido"
          value={netWorth}
          icon={Landmark}
          variant="primary"
          trend={monthlyTrend}
          trendLabel="vs mês anterior"
        />
      </div>

      {/* DRE Integration - Lucros Retidos */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Integração DRE → Patrimônio</CardTitle>
          </div>
          <CardDescription>
            O lucro líquido acumulado do DRE é automaticamente somado ao seu patrimônio líquido
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Lucro Mês Atual</p>
              <p className={cn('text-lg font-bold', currentMonthProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                {fmt(currentMonthProfit)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Lucro Mês Anterior</p>
              <p className={cn('text-lg font-bold', previousMonthProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                {fmt(previousMonthProfit)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Acumulado no Ano</p>
              <p className={cn('text-lg font-bold', yearToDateProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                {fmt(yearToDateProfit)}
              </p>
            </div>
            <div className="space-y-1 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3 text-primary" />
                <p className="text-xs font-medium text-primary">Lucros Retidos (Total)</p>
              </div>
              <p className={cn('text-lg font-bold', accumulatedProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                {fmt(accumulatedProfit)}
              </p>
              <p className="text-[10px] text-muted-foreground">Somado ao patrimônio líquido</p>
            </div>
          </div>

          {/* Composição do Patrimônio Líquido */}
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">Composição do Patrimônio Líquido</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Total de Ativos</span>
                <span className="font-medium">{fmt(totalAssets)}</span>
              </div>
              <div className="flex justify-between text-red-600 dark:text-red-400">
                <span>(-) Total de Passivos</span>
                <span className="font-medium">{fmt(totalLiabilities)}</span>
              </div>
              <div className="flex justify-between">
                <span>(=) Patrimônio Base</span>
                <span className="font-medium">{fmt(netWorthBase)}</span>
              </div>
              <div className="flex justify-between text-primary">
                <span>(+) Lucros Retidos (DRE)</span>
                <span className="font-medium">{fmt(accumulatedProfit)}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-border font-bold">
                <span>(=) Patrimônio Líquido</span>
                <span>{fmt(netWorth)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lucro Líquido Mensal Chart */}
      {profitChartData.some(d => d.receita > 0 || d.despesas > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Lucro Líquido Mensal (DRE)</CardTitle>
            <CardDescription>Impacto mensal no patrimônio líquido</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={profitChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend />
                  <Bar dataKey="receita" fill="hsl(152, 60%, 40%)" name="Receita" opacity={0.6} />
                  <Bar dataKey="despesas" fill="hsl(0, 72%, 51%)" name="Despesas" opacity={0.6} />
                  <Line type="monotone" dataKey="lucro" stroke="hsl(220, 70%, 45%)" strokeWidth={2} name="Lucro Líquido" dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chart */}
      {chartData.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Evolução Patrimonial</CardTitle>
            <CardDescription>Acompanhe o crescimento do seu patrimônio</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gradPatrimonio" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(220, 70%, 45%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(220, 70%, 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Area
                    type="monotone"
                    dataKey="patrimonio"
                    stroke="hsl(220, 70%, 45%)"
                    fill="url(#gradPatrimonio)"
                    strokeWidth={2}
                    name="Patrimônio Líquido"
                  />
                  <Line type="monotone" dataKey="ativos" stroke="hsl(152, 60%, 40%)" strokeWidth={1.5} strokeDasharray="4 4" name="Ativos" dot={false} />
                  <Line type="monotone" dataKey="passivos" stroke="hsl(0, 72%, 51%)" strokeWidth={1.5} strokeDasharray="4 4" name="Passivos" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}



      <Tabs defaultValue="ativos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ativos">Ativos</TabsTrigger>
          <TabsTrigger value="passivos">Passivos</TabsTrigger>
          <TabsTrigger value="mapa-riqueza">Mapa de Riqueza</TabsTrigger>
        </TabsList>

        <TabsContent value="ativos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Meus Ativos</CardTitle>
              <Dialog open={assetDialogOpen} onOpenChange={o => { setAssetDialogOpen(o); if (!o) setEditingAsset(undefined); }}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Ativo</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingAsset ? 'Editar Ativo' : 'Novo Ativo'}</DialogTitle>
                  </DialogHeader>
                  <AssetForm
                    asset={editingAsset}
                    onSave={a => upsertAsset.mutate(a)}
                    onClose={() => { setAssetDialogOpen(false); setEditingAsset(undefined); }}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {assets.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Nenhum ativo cadastrado. Clique em "Novo Ativo" para começar.</p>
              ) : (
                <GroupedTable
                  items={assets}
                  groups={ASSET_GROUPS}
                  categoryLabels={ASSET_CATEGORY_LABELS}
                  valueKey="current_value"
                  onEdit={a => { setEditingAsset(a); setAssetDialogOpen(true); }}
                  onDelete={id => removeAsset.mutate(id)}
                />
              )}
              <div className="flex justify-end mt-4 pt-3 border-t border-border">
                <span className="font-bold">Total: {fmt(totalAssets)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="passivos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg">Meus Passivos</CardTitle>
              <Dialog open={liabilityDialogOpen} onOpenChange={o => { setLiabilityDialogOpen(o); if (!o) setEditingLiability(undefined); }}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo Passivo</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingLiability ? 'Editar Passivo' : 'Novo Passivo'}</DialogTitle>
                  </DialogHeader>
                  <LiabilityForm
                    liability={editingLiability}
                    onSave={l => upsertLiability.mutate(l)}
                    onClose={() => { setLiabilityDialogOpen(false); setEditingLiability(undefined); }}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {liabilities.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Nenhum passivo cadastrado. Clique em "Novo Passivo" para começar.</p>
              ) : (
                <GroupedTable
                  items={liabilities}
                  groups={LIABILITY_GROUPS}
                  categoryLabels={LIABILITY_CATEGORY_LABELS}
                  valueKey="current_balance"
                  onEdit={l => { setEditingLiability(l); setLiabilityDialogOpen(true); }}
                  onDelete={id => removeLiability.mutate(id)}
                />
              )}
              <div className="flex justify-end mt-4 pt-3 border-t border-border">
                <span className="font-bold text-destructive">Total: {fmt(totalLiabilities)}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapa-riqueza" className="space-y-6">
          {/* Mapa de Riqueza Integrated Content */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Taxa de Crescimento', value: `${growthRate.toFixed(1)}%`, icon: TrendingUp },
              { label: 'Taxa de Poupança', value: `${savingsRate.toFixed(0)}%`, icon: PiggyBankIcon },
              { label: 'Patrimônio / Renda', value: `${wealthToIncomeYears.toFixed(1)} anos`, icon: BarChart3 },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} custom={i} initial="hidden" animate="visible" variants={cardVariant}>
                <Card className="glass-card border-border/30">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: 'hsl(var(--primary) / 0.1)' }}>
                      <kpi.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                      <p className="text-xl font-bold">{kpi.value}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div custom={4} initial="hidden" animate="visible" variants={cardVariant}>
              <Card className="glass-card border-border/30">
                <CardHeader>
                  <CardTitle className="text-base font-display">Composição do Patrimônio</CardTitle>
                </CardHeader>
                <CardContent>
                  {compositionData.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Cadastre ativos para ver a composição</p>
                  ) : (
                    <>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={compositionData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                              paddingAngle={2} dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={false}
                            >
                              {compositionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v: number) => formatBRL(v)} {...tooltipStyle} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2 mt-4">
                        {compositionData.map((d, i) => (
                          <div key={d.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <span className="text-muted-foreground">{d.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-medium">{formatBRL(d.value)}</span>
                              <Badge variant="secondary" className="text-xs">
                                {totalAssets > 0 ? ((d.value / totalAssets) * 100).toFixed(0) : 0}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div custom={5} initial="hidden" animate="visible" variants={cardVariant}>
              <Card className="glass-card border-border/30">
                <CardHeader>
                  <CardTitle className="text-base font-display">Motores de Crescimento</CardTitle>
                </CardHeader>
                <CardContent>
                  {totalGrowth <= 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Dados insuficientes para calcular motores de crescimento</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={growthDrivers} layout="vertical" margin={{ left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
                            <Tooltip formatter={(v: number) => formatBRL(v)} {...tooltipStyle} />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                              {growthDrivers.map((d, i) => <Cell key={i} fill={d.color} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2">
                        {growthDrivers.map(d => (
                          <div key={d.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/30">
                            <div className="flex items-center gap-2">
                              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                              <span className="text-xs font-medium">{d.name}</span>
                            </div>
                            <span className="text-sm font-bold">{formatBRL(d.value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <motion.div custom={6} initial="hidden" animate="visible" variants={cardVariant}>
            <Card className="glass-card border-border/30">
              <CardHeader>
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-warning" />
                  Insights Estratégicos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {riquezaInsights.map((msg, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg p-3 bg-primary/5 text-sm">
                    <TrendingUp className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                    <p className="text-foreground">{msg}</p>
                  </div>
                ))}
                {riquezaInsights.length === 0 && (
                  <p className="text-sm text-muted-foreground">Cadastre seus dados para gerar insights.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
