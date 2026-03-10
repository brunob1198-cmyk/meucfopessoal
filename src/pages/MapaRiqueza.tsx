import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAssets, useLiabilities, useNetWorthHistory, ASSET_CATEGORY_LABELS } from '@/hooks/useBalanceSheet';
import { useDREIntegration } from '@/hooks/useDREIntegration';
import { formatBRL } from '@/lib/dre';
import { Loader2, TrendingUp, Wallet, PiggyBank, BarChart3, Gem, Lightbulb } from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, BarChart, Bar
} from 'recharts';

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
    color: '#fff'
  }
};

// Group asset categories for composition
const COMPOSITION_GROUPS: Record<string, string[]> = {
  'Investimentos': ['renda_fixa', 'acoes', 'fundos', 'criptomoedas'],
  'Imóveis': ['imoveis'],
  'Caixa': ['conta_corrente', 'poupanca', 'dinheiro_caixa'],
  'Veículos': ['veiculos'],
  'Outros': ['participacoes', 'outros_bens'],
};

export default function MapaRiqueza() {
  const { data: assets = [], isLoading: assetsLoading } = useAssets();
  const { data: liabilities = [], isLoading: liabLoading } = useLiabilities();
  const { data: netWorthHistory = [], isLoading: histLoading } = useNetWorthHistory();
  const dreData = useDREIntegration();

  const isLoading = assetsLoading || liabLoading || histLoading || dreData.isLoading;

  const totalAssets = useMemo(() => assets.reduce((s, a) => s + Number(a.current_value), 0), [assets]);
  const totalLiabilities = useMemo(() => liabilities.reduce((s, l) => s + Number(l.current_balance), 0), [liabilities]);
  const netWorth = totalAssets - totalLiabilities;

  // Growth in last 12 months
  const growth12m = useMemo(() => {
    if (netWorthHistory.length < 2) return null;
    const sorted = [...netWorthHistory].sort((a, b) => a.month.localeCompare(b.month));
    const latest = sorted[sorted.length - 1];
    const yearAgo = sorted.find(s => {
      const d = new Date(s.month);
      const l = new Date(latest.month);
      return l.getFullYear() - d.getFullYear() === 1 && l.getMonth() === d.getMonth();
    }) || sorted[0];
    return Number(latest.net_worth) - Number(yearAgo.net_worth);
  }, [netWorthHistory]);

  // Composition data
  const compositionData = useMemo(() => {
    return Object.entries(COMPOSITION_GROUPS).map(([label, cats]) => {
      const value = assets
        .filter(a => cats.includes(a.category))
        .reduce((s, a) => s + Number(a.current_value), 0);
      return { name: label, value };
    }).filter(d => d.value > 0);
  }, [assets]);

  // Evolution chart data
  const evolutionData = useMemo(() => {
    return [...netWorthHistory]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(s => ({
        month: new Date(s.month).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        patrimonio: Number(s.net_worth),
        ativos: Number(s.total_assets),
        passivos: Number(s.total_liabilities),
      }));
  }, [netWorthHistory]);

  // Growth drivers estimation
  const avgMonthlySavings = useMemo(() => {
    const profits = dreData.monthlyProfits.filter(p => p.receita > 0);
    if (profits.length === 0) return 0;
    return profits.reduce((s, p) => s + (p.receita - p.despesas), 0) / profits.length;
  }, [dreData.monthlyProfits]);

  const annualSavings = avgMonthlySavings * 12;
  const totalGrowth = growth12m || 0;
  const investmentReturns = Math.max(0, totalGrowth - annualSavings) * 0.7;
  const assetAppreciation = Math.max(0, totalGrowth - annualSavings - investmentReturns);

  const growthDrivers = [
    { name: 'Poupança', value: Math.max(0, annualSavings), color: 'hsl(160, 50%, 40%)' },
    { name: 'Retorno Investimentos', value: Math.max(0, investmentReturns), color: 'hsl(220, 50%, 45%)' },
    { name: 'Valorização de Ativos', value: Math.max(0, assetAppreciation), color: 'hsl(38, 55%, 45%)' },
  ];

  // Indicators
  const avgMonthlyIncome = useMemo(() => {
    const profits = dreData.monthlyProfits.filter(p => p.receita > 0);
    return profits.length > 0 ? profits.reduce((s, p) => s + p.receita, 0) / profits.length : 0;
  }, [dreData.monthlyProfits]);

  const savingsRate = avgMonthlyIncome > 0 ? (avgMonthlySavings / avgMonthlyIncome) * 100 : 0;
  const wealthToIncomeYears = avgMonthlyIncome > 0 ? netWorth / (avgMonthlyIncome * 12) : 0;
  const growthRate = growth12m !== null && netWorth > 0 ? (growth12m / (netWorth - growth12m)) * 100 : 0;

  // Insights
  const insights = useMemo(() => {
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
      msgs.push(`Sua taxa de poupança é ${savingsRate.toFixed(0)}%. Tente aumentar para 20%+.`);
    }
    if (msgs.length === 0) msgs.push('Cadastre seus ativos e passivos para gerar insights personalizados.');
    return msgs;
  }, [growth12m, growthRate, annualSavings, totalGrowth, totalAssets, assets, savingsRate, netWorth]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Gem className="h-7 w-7 text-primary" />
          Mapa de Riqueza
        </h1>
        <p className="text-muted-foreground mt-1">Visão estratégica do seu patrimônio e evolução financeira</p>
      </div>

      {/* Net Worth Hero */}
      <motion.div custom={0} initial="hidden" animate="visible" variants={cardVariant}>
        <Card className="glass-card float-card glow-border border-border/30">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-2">
                  <Wallet className="h-4 w-4" /> Patrimônio Líquido
                </p>
                <p className="text-3xl md:text-4xl font-bold mt-2 text-foreground">{formatBRL(netWorth)}</p>
                {growth12m !== null && (
                  <p className={`text-sm mt-1 ${growth12m >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {growth12m >= 0 ? '+' : ''}{formatBRL(growth12m)} nos últimos 12 meses
                    {growthRate !== 0 && ` (${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(1)}%)`}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Ativos</p>
                  <p className="text-lg font-bold text-primary">{formatBRL(totalAssets)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Passivos</p>
                  <p className="text-lg font-bold text-destructive">{formatBRL(totalLiabilities)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Líquido</p>
                  <p className={`text-lg font-bold ${netWorth >= 0 ? 'text-primary' : 'text-destructive'}`}>{formatBRL(netWorth)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Taxa de Crescimento', value: `${growthRate.toFixed(1)}%`, icon: TrendingUp },
          { label: 'Taxa de Poupança', value: `${savingsRate.toFixed(0)}%`, icon: PiggyBank },
          { label: 'Patrimônio / Renda', value: `${wealthToIncomeYears.toFixed(1)} anos`, icon: BarChart3 },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} custom={i + 1} initial="hidden" animate="visible" variants={cardVariant}>
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

      {/* Composition + Evolution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Composition */}
        <motion.div custom={4} initial="hidden" animate="visible" variants={cardVariant}>
          <Card className="glass-card float-card border-border/30">
            <CardHeader>
              <CardTitle className="text-base font-display">Composição do Patrimônio</CardTitle>
            </CardHeader>
            <CardContent>
              {compositionData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Cadastre ativos no Balanço Patrimonial</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={compositionData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                        paddingAngle={2} dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                        stroke="hsl(200 35% 12%)" strokeWidth={2}
                      >
                        {compositionData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatBRL(v)} {...tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
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

        {/* Evolution */}
        <motion.div custom={5} initial="hidden" animate="visible" variants={cardVariant}>
          <Card className="glass-card float-card border-border/30">
            <CardHeader>
              <CardTitle className="text-base font-display">Evolução da Riqueza</CardTitle>
            </CardHeader>
            <CardContent>
              {evolutionData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Snapshots serão gerados automaticamente no Balanço Patrimonial</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 25% 18% / 0.5)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(207 25% 60%)' }} />
                    <YAxis tick={{ fontSize: 11, fill: 'hsl(207 25% 60%)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatBRL(v)} {...tooltipStyle} />
                    <Legend />
                    <Area type="monotone" dataKey="ativos" name="Ativos" fill="hsl(160 50% 40% / 0.2)" stroke="hsl(160, 50%, 40%)" strokeWidth={2} />
                    <Area type="monotone" dataKey="passivos" name="Passivos" fill="hsl(0 45% 42% / 0.2)" stroke="hsl(0, 45%, 42%)" strokeWidth={2} />
                    <Area type="monotone" dataKey="patrimonio" name="Patrimônio Líquido" fill="hsl(220 50% 45% / 0.3)" stroke="hsl(220, 50%, 45%)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Growth Drivers */}
      <motion.div custom={6} initial="hidden" animate="visible" variants={cardVariant}>
        <Card className="glass-card float-card border-border/30">
          <CardHeader>
            <CardTitle className="text-base font-display">Motores de Crescimento da Riqueza</CardTitle>
          </CardHeader>
          <CardContent>
            {totalGrowth <= 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Dados insuficientes para calcular motores de crescimento</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={growthDrivers} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 25% 18% / 0.5)" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(207 25% 60%)' }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'hsl(207 25% 60%)' }} width={140} />
                    <Tooltip formatter={(v: number) => formatBRL(v)} {...tooltipStyle} />
                    <Bar dataKey="value" name="Contribuição" radius={[0, 6, 6, 0]}>
                      {growthDrivers.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-4">
                  {growthDrivers.map(d => (
                    <div key={d.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                      <div className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-sm font-medium">{d.name}</span>
                      </div>
                      <span className="font-bold">{formatBRL(d.value)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <span className="text-sm font-bold text-primary">Total Crescimento</span>
                    <span className="font-bold text-primary">{formatBRL(totalGrowth)}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Insights */}
      <motion.div custom={7} initial="hidden" animate="visible" variants={cardVariant}>
        <Card className="glass-card border-border/30">
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-warning" />
              Insights Automáticos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.map((msg, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg p-3 bg-primary/5 text-sm">
                <TrendingUp className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <p className="text-foreground">{msg}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
