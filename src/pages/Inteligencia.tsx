import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Brain, AlertTriangle, Lightbulb, TrendingUp, RefreshCw, Sparkles, History, Calendar, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Forecast {
  summary: string;
  projected_savings: number;
  trend: string;
  details: string[];
}

interface AnalysisResult {
  insights: string[];
  alerts: string[];
  suggestions: string[];
  forecast: Forecast | null;
}

interface HistoryItem {
  id: string;
  period_start: string | null;
  period_end: string | null;
  result: AnalysisResult;
  created_at: string;
}

const PERIOD_OPTIONS = [
  { label: 'Últimos 12 meses', value: '12m' },
  { label: 'Último trimestre', value: '3m' },
  { label: 'Último semestre', value: '6m' },
  { label: 'Personalizado', value: 'custom' },
];

function monthOptions() {
  const opts: { label: string; value: string }[] = [];
  const now = new Date();
  for (let i = -24; i <= 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    opts.push({
      label: format(d, 'MMM/yyyy', { locale: ptBR }),
      value: format(d, 'yyyy-MM'),
    });
  }
  return opts;
}

export default function Inteligencia() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [periodType, setPeriodType] = useState('12m');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const months = monthOptions();

  // Load last analysis on mount
  useEffect(() => {
    if (!user) return;
    loadLastAnalysis();
  }, [user]);

  const loadLastAnalysis = async () => {
    const { data } = await supabase
      .from('analysis_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      setResult(data[0].result as unknown as AnalysisResult);
    }
  };

  const loadHistory = async () => {
    const { data } = await supabase
      .from('analysis_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) {
      setHistory(data as unknown as HistoryItem[]);
    }
    setShowHistory(true);
  };

  const deleteAnalysis = async (id: string) => {
    const { error } = await supabase.from('analysis_history').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir análise');
      return;
    }
    setHistory(prev => prev.filter(h => h.id !== id));
    toast.success('Análise excluída');
  };

  const getPeriodDates = () => {
    const now = new Date();
    if (periodType === 'custom') {
      return {
        periodStart: customStart ? customStart + '-01' : null,
        periodEnd: customEnd ? customEnd + '-28' : null,
      };
    }
    const monthsBack = periodType === '3m' ? 3 : periodType === '6m' ? 6 : 12;
    const start = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    return {
      periodStart: format(start, 'yyyy-MM-dd'),
      periodEnd: null,
    };
  };

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const { periodStart, periodEnd } = getPeriodDates();
      const { data, error } = await supabase.functions.invoke('financial-insights', {
        body: { periodStart, periodEnd },
      });
      if (error) throw error;
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setResult(data);
      toast.success('Análise concluída!');
    } catch (err: any) {
      toast.error('Erro ao gerar análise: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const trendIcon = (trend?: string) => {
    if (trend === 'positiva') return '📈';
    if (trend === 'negativa') return '📉';
    return '➡️';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            CFO Pessoal Digital
          </h1>
          <p className="text-sm text-muted-foreground">
            Análise inteligente dos seus dados financeiros com IA
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadHistory} className="gap-1.5">
            <History className="h-4 w-4" />
            Histórico
          </Button>
          <Button onClick={runAnalysis} disabled={loading} className="gap-2" size="sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {loading ? 'Analisando...' : result ? 'Atualizar Análise' : 'Gerar Análise'}
          </Button>
        </div>
      </div>

      {/* Period Filter */}
      <Card>
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Período:</span>
          <Select value={periodType} onValueChange={setPeriodType}>
            <SelectTrigger className="w-[180px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {periodType === 'custom' && (
            <>
              <Select value={customStart} onValueChange={setCustomStart}>
                <SelectTrigger className="w-[130px] h-8 text-sm">
                  <SelectValue placeholder="De" />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">até</span>
              <Select value={customEnd} onValueChange={setCustomEnd}>
                <SelectTrigger className="w-[130px] h-8 text-sm">
                  <SelectValue placeholder="Até" />
                </SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </CardContent>
      </Card>

      {!result && !loading && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Brain className="h-16 w-16 text-muted-foreground/40" />
            <div className="text-center space-y-2">
              <h2 className="text-lg font-semibold text-foreground">Seu CFO pessoal está pronto</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Clique em "Gerar Análise" para que a IA analise seus lançamentos, identifique padrões,
                gere alertas e sugira melhorias para suas finanças.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analisando seus dados financeiros...</p>
        </div>
      )}

      {result && !loading && <AnalysisDisplay result={result} trendIcon={trendIcon} />}

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de Análises</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma análise anterior encontrada.</p>
            ) : (
              history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setResult(item.result);
                    setShowHistory(false);
                  }}
                  className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.period_start && item.period_end
                        ? `${item.period_start.substring(0, 7)} a ${item.period_end.substring(0, 7)}`
                        : item.period_start
                        ? `Desde ${item.period_start.substring(0, 7)}`
                        : 'Últimos 12 meses'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {item.result.insights?.[0] || 'Análise financeira'}
                  </p>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnalysisDisplay({ result, trendIcon }: { result: AnalysisResult; trendIcon: (t?: string) => string }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.insights.map((insight, i) => (
            <div key={i} className="flex gap-3 items-start p-3 rounded-lg bg-primary/5 border border-primary/10">
              <span className="text-primary font-bold text-sm mt-0.5">{i + 1}</span>
              <p className="text-sm text-foreground leading-relaxed">{insight}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Alertas Financeiros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              ✅ Nenhum alerta identificado. Suas finanças estão em dia!
            </p>
          ) : (
            result.alerts.map((alert, i) => (
              <div key={i} className="flex gap-3 items-start p-3 rounded-lg bg-destructive/5 border border-destructive/15">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-foreground leading-relaxed">{alert}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-warning" />
            Sugestões de Melhoria
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.suggestions.map((suggestion, i) => (
            <div key={i} className="flex gap-3 items-start p-3 rounded-lg bg-warning/5 border border-warning/15">
              <Lightbulb className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-sm text-foreground leading-relaxed">{suggestion}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[hsl(var(--chart-receita))]" />
            Previsão Financeira
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {result.forecast ? (
            <>
              <div className="p-3 rounded-lg bg-[hsl(var(--chart-receita))]/5 border border-[hsl(var(--chart-receita))]/15">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{trendIcon(result.forecast.trend)}</span>
                  <span className="text-sm font-medium text-foreground capitalize">
                    Tendência {result.forecast.trend}
                  </span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{result.forecast.summary}</p>
              </div>
              {result.forecast.projected_savings > 0 && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="text-sm text-muted-foreground">Economia potencial estimada</p>
                  <p className="text-lg font-bold text-primary">
                    {result.forecast.projected_savings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
              )}
              {result.forecast.details?.length > 0 && (
                <div className="space-y-2">
                  {result.forecast.details.map((detail, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <span className="text-xs text-muted-foreground mt-1">•</span>
                      <p className="text-sm text-foreground leading-relaxed">{detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Dados insuficientes para previsão.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
