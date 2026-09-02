import { useEffect } from 'react';
import { useFinancialHealthScore, useFinancialHealthScoreHistory } from '@/hooks/useFinancialHealthScore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, AlertCircle, Info, ChevronRight } from 'lucide-react';
import { getClassification } from '@/lib/financialHealthScore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, startOfMonth } from 'date-fns';
import { formatMonthLabel } from '@/lib/balanceSheet';

const PILLAR_ICONS = {
  'Liquidez': '💧',
  'Controle de Gastos': '📊',
  'Endividamento': '⚖️',
  'Reserva de Emergência': '🛡️',
  'Capacidade de Poupança': '💰',
};

function ScoreCircle({ score, max = 100, size = 120, strokeWidth = 12 }: { 
  score: number; 
  max?: number; 
  size?: number; 
  strokeWidth?: number; 
}) {
  const percentage = (score / max) * 100;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = (p: number) => getClassification(p).color;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(percentage)}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-in-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{score}</span>
        <span className="text-xs text-muted-foreground">/{max}</span>
      </div>
    </div>
  );
}

function PillarCard({ pillar }: { pillar: any }) {
  const percentage = (pillar.score / pillar.max) * 100;
  
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{PILLAR_ICONS[pillar.name as keyof typeof PILLAR_ICONS]}</span>
            <CardTitle className="text-base">{pillar.name}</CardTitle>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold">{pillar.score}</span>
            <span className="text-sm text-muted-foreground">/{pillar.max}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">{pillar.indicator}</span>
            <span className="text-sm text-muted-foreground">{pillar.indicatorValue}</span>
          </div>
          <Progress 
            value={percentage} 
            className="h-2" 
            style={{ 
              '--progress-background': pillar.color,
            } as any}
          />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{pillar.insight}</p>
      </CardContent>
    </Card>
  );
}

export default function FinancialHealthScore() {
  const { total, classification, classificationColor, pillars, recommendations, isLoading } = useFinancialHealthScore();
  const { data: scoreHistory = [], saveSnapshot } = useFinancialHealthScoreHistory();

  // Salva um retrato do score do mês atual sempre que ele é recalculado —
  // mesmo mecanismo de auto-snapshot já usado para o Patrimônio Líquido em
  // BalancoPatrimonial.tsx. O histórico começa a partir de agora: não dá para
  // reconstruir meses passados (3 dos 5 pilares dependem do saldo atual de
  // ativos/passivos, que nunca foi guardado categoria a categoria no passado).
  useEffect(() => {
    if (isLoading) return;
    const pillarScore = (name: string) => pillars.find((p) => p.name === name)?.score ?? 0;
    saveSnapshot.mutate({
      month: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      total_score: total,
      liquidez_score: pillarScore('Liquidez'),
      controle_gastos_score: pillarScore('Controle de Gastos'),
      endividamento_score: pillarScore('Endividamento'),
      reserva_emergencia_score: pillarScore('Reserva de Emergência'),
      capacidade_poupanca_score: pillarScore('Capacidade de Poupança'),
    });
  }, [isLoading, total, pillars]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const evolutionData = scoreHistory.map((h) => ({
    mes: formatMonthLabel(h.month),
    score: h.total_score,
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Score de Saúde Financeira</h1>
          <p className="text-sm text-muted-foreground">
            Sua pontuação financeira baseada em 5 pilares fundamentais
          </p>
        </div>
      </div>

      {/* Score Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 bg-gradient-to-br from-background to-muted/20">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <ScoreCircle score={total} />
            <div className="mt-4 text-center">
              <Badge 
                variant="secondary" 
                className="text-base px-3 py-1"
                style={{ 
                  backgroundColor: `${classificationColor}20`,
                  color: classificationColor,
                  border: `1px solid ${classificationColor}40`
                }}
              >
                {classification}
              </Badge>
              <p className="text-xs text-muted-foreground mt-2">
                Pontuação geral da saúde financeira
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Distribuição por Pilar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pillars.map((pillar, index) => {
                const percentage = (pillar.score / pillar.max) * 100;
                return (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-24 text-sm font-medium text-right">
                      {pillar.name}
                    </div>
                    <div className="flex-1">
                      <Progress 
                        value={percentage} 
                        className="h-6"
                        style={{ 
                          '--progress-background': pillar.color,
                        } as any}
                      />
                    </div>
                    <div className="w-16 text-sm font-medium text-right">
                      {pillar.score}/{pillar.max}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pillars" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pillars">Detalhamento dos Pilares</TabsTrigger>
          <TabsTrigger value="recommendations">Recomendações</TabsTrigger>
          <TabsTrigger value="evolution">Evolução</TabsTrigger>
        </TabsList>

        <TabsContent value="pillars" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pillars.map((pillar, index) => (
              <PillarCard key={index} pillar={pillar} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Plano de Ação Personalizado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border">
                    {index === 0 ? (
                      <AlertCircle className="h-5 w-5 mt-0.5 text-primary shrink-0" />
                    ) : (
                      <Info className="h-5 w-5 mt-0.5 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm text-foreground leading-relaxed">{rec}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="evolution">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Evolução</CardTitle>
            </CardHeader>
            <CardContent className={evolutionData.length < 2 ? 'py-8' : undefined}>
              {evolutionData.length < 2 ? (
                <div className="text-center text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Construindo seu histórico</p>
                  <p className="text-sm">
                    A partir de agora, seu score é registrado automaticamente todo mês. Volte aqui daqui a algumas
                    semanas para acompanhar a evolução ao longo do tempo.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={evolutionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => [`${v}/100`, 'Score']} />
                    <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}