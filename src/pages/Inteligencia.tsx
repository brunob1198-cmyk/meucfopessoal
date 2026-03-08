import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Brain, AlertTriangle, Lightbulb, TrendingUp, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

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

export default function Inteligencia() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('financial-insights');
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
        <Button onClick={runAnalysis} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {loading ? 'Analisando...' : result ? 'Atualizar Análise' : 'Gerar Análise'}
        </Button>
      </div>

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

      {result && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Insights */}
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

          {/* Alertas */}
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

          {/* Sugestões */}
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

          {/* Previsão */}
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
      )}
    </div>
  );
}
