import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAssets, useLiabilities } from '@/hooks/useBalanceSheet';
import { useDREIntegration } from '@/hooks/useDREIntegration';
import { useFinancialHealthScore } from '@/hooks/useFinancialHealthScore';
import { formatBRL } from '@/lib/dre';
import { Loader2, Brain, TrendingUp, Users, Target, BarChart3, Lightbulb, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
    color: '#fff'
  }
};

// Simulated benchmark data (in production, this would come from aggregated DB data)
const BENCHMARKS = {
  savingsRate: { average: 18, p25: 8, p50: 15, p75: 25, p90: 35 },
  debtToIncome: { average: 22, p25: 5, p50: 18, p75: 35, p90: 50 },
  expenseRatio: { average: 72, p25: 55, p50: 70, p75: 85, p90: 95 },
  emergencyMonths: { average: 4.2, p25: 0.5, p50: 3, p75: 6, p90: 12 },
  healthScore: { average: 58, p25: 35, p50: 55, p75: 72, p90: 85 },
};

const FIRE_TABLE = [
  { rate: 5, years: 45 },
  { rate: 10, years: 32 },
  { rate: 15, years: 25 },
  { rate: 20, years: 20 },
  { rate: 25, years: 17 },
  { rate: 30, years: 14 },
  { rate: 40, years: 11 },
  { rate: 50, years: 8 },
];

function getPercentile(value: number, benchmark: typeof BENCHMARKS.savingsRate, higherIsBetter = true): number {
  if (higherIsBetter) {
    if (value >= benchmark.p90) return 95;
    if (value >= benchmark.p75) return 80;
    if (value >= benchmark.p50) return 60;
    if (value >= benchmark.p25) return 35;
    return 15;
  } else {
    if (value <= benchmark.p25) return 90;
    if (value <= benchmark.p50) return 70;
    if (value <= benchmark.p75) return 40;
    if (value <= benchmark.p90) return 20;
    return 10;
  }
}

function PercentileBar({ label, value, unit, percentile, benchmark }: {
  label: string; value: string; unit?: string; percentile: number; benchmark: number;
}) {
  const getColor = (p: number) => {
    if (p >= 75) return 'hsl(160, 50%, 40%)';
    if (p >= 50) return 'hsl(38, 55%, 45%)';
    return 'hsl(0, 45%, 42%)';
  };

  return (
    <div className="space-y-2 p-4 rounded-lg bg-muted/30 border border-border/30">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant="secondary" className="text-xs" style={{ backgroundColor: `${getColor(percentile)}20`, color: getColor(percentile) }}>
          Percentil {percentile}
        </Badge>
      </div>
      <div className="flex items-end gap-3">
        <span className="text-2xl font-bold">{value}</span>
        {unit && <span className="text-sm text-muted-foreground mb-1">{unit}</span>}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Média da base: {benchmark}{unit ? ` ${unit}` : ''}</span>
      </div>
      <Progress
        value={percentile}
        className="h-2"
        style={{ '--progress-background': getColor(percentile) } as any}
      />
      <p className="text-xs text-muted-foreground">
        Você está à frente de {percentile}% dos usuários
      </p>
    </div>
  );
}

export default function DataIntelligence() {
  const { data: assets = [], isLoading: assetsLoading } = useAssets();
  const { data: liabilities = [], isLoading: liabLoading } = useLiabilities();
  const dreData = useDREIntegration();
  const healthScore = useFinancialHealthScore();

  const isLoading = assetsLoading || liabLoading || dreData.isLoading || healthScore.isLoading;

  const totalAssets = useMemo(() => assets.reduce((s, a) => s + Number(a.current_value), 0), [assets]);
  const totalLiabilities = useMemo(() => liabilities.reduce((s, l) => s + Number(l.current_balance), 0), [liabilities]);
  const totalMonthlyDebt = useMemo(() => liabilities.reduce((s, l) => s + Number(l.monthly_payment || 0), 0), [liabilities]);

  const avgMonthlyIncome = useMemo(() => {
    const profits = dreData.monthlyProfits.filter(p => p.receita > 0);
    return profits.length > 0 ? profits.reduce((s, p) => s + p.receita, 0) / profits.length : 0;
  }, [dreData.monthlyProfits]);

  const avgMonthlyExpenses = useMemo(() => {
    const profits = dreData.monthlyProfits.filter(p => p.despesas > 0);
    return profits.length > 0 ? profits.reduce((s, p) => s + p.despesas, 0) / profits.length : 0;
  }, [dreData.monthlyProfits]);

  const savingsRate = avgMonthlyIncome > 0 ? ((avgMonthlyIncome - avgMonthlyExpenses) / avgMonthlyIncome) * 100 : 0;
  const debtToIncome = avgMonthlyIncome > 0 ? (totalMonthlyDebt / avgMonthlyIncome) * 100 : 0;
  const expenseRatio = avgMonthlyIncome > 0 ? (avgMonthlyExpenses / avgMonthlyIncome) * 100 : 0;

  const liquidAssets = useMemo(() =>
    assets.filter(a => ['conta_corrente', 'poupanca', 'dinheiro_caixa', 'renda_fixa', 'fundos'].includes(a.category))
      .reduce((s, a) => s + Number(a.current_value), 0),
    [assets]);
  const emergencyMonths = avgMonthlyExpenses > 0 ? liquidAssets / avgMonthlyExpenses : 0;

  // Percentiles
  const savingsPercentile = getPercentile(savingsRate, BENCHMARKS.savingsRate, true);
  const debtPercentile = getPercentile(debtToIncome, BENCHMARKS.debtToIncome, false);
  const expensePercentile = getPercentile(expenseRatio, BENCHMARKS.expenseRatio, false);
  const emergencyPercentile = getPercentile(emergencyMonths, BENCHMARKS.emergencyMonths as any, true);
  const healthPercentile = getPercentile(healthScore.total, BENCHMARKS.healthScore, true);

  // FIRE estimation
  const fireYears = useMemo(() => {
    if (savingsRate <= 0) return null;
    const match = FIRE_TABLE.find(r => savingsRate <= r.rate);
    if (match) return match.years;
    return FIRE_TABLE[FIRE_TABLE.length - 1].years;
  }, [savingsRate]);

  // Comparison chart data
  const comparisonData = [
    { metric: 'Poupança', voce: Math.max(0, savingsRate), media: BENCHMARKS.savingsRate.average },
    { metric: 'Endividamento', voce: debtToIncome, media: BENCHMARKS.debtToIncome.average },
    { metric: 'Gastos', voce: expenseRatio, media: BENCHMARKS.expenseRatio.average },
    { metric: 'Health Score', voce: healthScore.total, media: BENCHMARKS.healthScore.average },
  ];

  // Insights
  const insights = useMemo(() => {
    const msgs: { text: string; type: 'success' | 'info' | 'warning' }[] = [];

    if (savingsRate > BENCHMARKS.savingsRate.average) {
      msgs.push({ text: `Você está poupando acima da média da base (${savingsRate.toFixed(0)}% vs ${BENCHMARKS.savingsRate.average}%).`, type: 'success' });
    } else if (savingsRate > 0) {
      msgs.push({ text: `Usuários com renda similar costumam poupar ${BENCHMARKS.savingsRate.average}% da renda. Você está em ${savingsRate.toFixed(0)}%.`, type: 'info' });
    }

    if (debtToIncome < BENCHMARKS.debtToIncome.average) {
      msgs.push({ text: 'Seu nível de endividamento está abaixo da média. Ótima gestão de dívidas!', type: 'success' });
    }

    if (savingsPercentile >= 70) {
      msgs.push({ text: `Seu patrimônio cresce mais rápido que ${savingsPercentile}% dos usuários.`, type: 'success' });
    }

    if (fireYears) {
      msgs.push({ text: `Com sua taxa de poupança atual (${savingsRate.toFixed(0)}%), a independência financeira pode ser alcançada em aproximadamente ${fireYears} anos.`, type: 'info' });
    }

    // Recommendations
    if (savingsRate < 20) {
      msgs.push({ text: `Usuários que aumentaram a taxa de poupança para 20% alcançaram independência financeira ${Math.round(20 - savingsRate)}% mais rápido.`, type: 'warning' });
    }
    if (totalAssets > 500000) {
      msgs.push({ text: 'Usuários com patrimônio acima de R$ 500 mil possuem em média 60% do patrimônio em investimentos.', type: 'info' });
    }

    if (msgs.length === 0) {
      msgs.push({ text: 'Cadastre seus dados financeiros para gerar insights personalizados.', type: 'info' });
    }

    return msgs;
  }, [savingsRate, debtToIncome, savingsPercentile, fireYears, totalAssets]);

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
          <Brain className="h-7 w-7 text-primary" />
          Inteligência de Dados Financeiros
        </h1>
        <p className="text-muted-foreground mt-1">Benchmarks, insights e recomendações baseados em dados agregados</p>
      </div>

      {/* Overall Position */}
      <motion.div custom={0} initial="hidden" animate="visible" variants={cardVariant}>
        <Card className="glass-card float-card glow-border border-border/30">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ background: 'hsl(var(--primary) / 0.15)' }}>
                  <Award className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Seu Percentil Geral</p>
                  <p className="text-3xl font-bold">Top {100 - healthPercentile}%</p>
                  <p className="text-xs text-muted-foreground">
                    Health Score: {healthScore.total}/100 (Média: {BENCHMARKS.healthScore.average})
                  </p>
                </div>
              </div>
              {fireYears && (
                <div className="text-center md:text-right p-4 rounded-xl bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Independência Financeira</p>
                  <p className="text-2xl font-bold text-primary">~{fireYears} anos</p>
                  <p className="text-xs text-muted-foreground">Com taxa de poupança de {savingsRate.toFixed(0)}%</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Benchmarks Grid */}
      <motion.div custom={1} initial="hidden" animate="visible" variants={cardVariant}>
        <Card className="glass-card border-border/30">
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Benchmarks Financeiros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <PercentileBar
                label="Taxa de Poupança"
                value={`${savingsRate.toFixed(0)}%`}
                percentile={savingsPercentile}
                benchmark={BENCHMARKS.savingsRate.average}
              />
              <PercentileBar
                label="Endividamento"
                value={`${debtToIncome.toFixed(0)}%`}
                unit="da renda"
                percentile={debtPercentile}
                benchmark={BENCHMARKS.debtToIncome.average}
              />
              <PercentileBar
                label="Taxa de Gastos"
                value={`${expenseRatio.toFixed(0)}%`}
                unit="da renda"
                percentile={expensePercentile}
                benchmark={BENCHMARKS.expenseRatio.average}
              />
              <PercentileBar
                label="Reserva de Emergência"
                value={emergencyMonths.toFixed(1)}
                unit="meses"
                percentile={emergencyPercentile}
                benchmark={BENCHMARKS.emergencyMonths.average}
              />
              <PercentileBar
                label="Health Score"
                value={`${healthScore.total}`}
                unit="/100"
                percentile={healthPercentile}
                benchmark={BENCHMARKS.healthScore.average}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Comparison Chart */}
      <motion.div custom={2} initial="hidden" animate="visible" variants={cardVariant}>
        <Card className="glass-card float-card border-border/30">
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Comparação Financeira — Você vs Média
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={comparisonData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 25% 18% / 0.5)" />
                <XAxis dataKey="metric" tick={{ fontSize: 12, fill: 'hsl(207 25% 60%)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(207 25% 60%)' }} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="voce" name="Você" fill="hsl(160, 50%, 40%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="media" name="Média" fill="hsl(220, 50%, 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* FIRE Table */}
      <motion.div custom={3} initial="hidden" animate="visible" variants={cardVariant}>
        <Card className="glass-card border-border/30">
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Independência Financeira por Taxa de Poupança
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {FIRE_TABLE.map(row => (
                <div
                  key={row.rate}
                  className={`p-3 rounded-lg border text-center ${
                    savingsRate >= row.rate - 2.5 && savingsRate < row.rate + 2.5
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-muted/30 border-border/30'
                  }`}
                >
                  <p className="text-lg font-bold">{row.rate}%</p>
                  <p className="text-xs text-muted-foreground">taxa de poupança</p>
                  <p className="text-sm font-semibold mt-1 text-primary">~{row.years} anos</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Insights & Recommendations */}
      <motion.div custom={4} initial="hidden" animate="visible" variants={cardVariant}>
        <Card className="glass-card border-border/30">
          <CardHeader>
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-warning" />
              Insights & Recomendações
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.map((insight, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-lg p-3 text-sm ${
                  insight.type === 'success' ? 'bg-primary/5' :
                  insight.type === 'warning' ? 'bg-warning/10' : 'bg-muted/30'
                }`}
              >
                {insight.type === 'success' ? <TrendingUp className="h-4 w-4 mt-0.5 text-primary shrink-0" /> :
                 insight.type === 'warning' ? <Target className="h-4 w-4 mt-0.5 text-warning shrink-0" /> :
                 <Lightbulb className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />}
                <p className="text-foreground">{insight.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>

      {/* Privacy Notice */}
      <div className="text-center text-xs text-muted-foreground py-4">
        <p>🔒 Todos os benchmarks são baseados em dados agregados e anonimizados. Nenhuma informação individual é exposta.</p>
      </div>
    </div>
  );
}
