import type { CSSProperties } from 'react';
import { useFinancialHealthScore } from '@/hooks/useFinancialHealthScore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, HeartPulse, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function getScoreToneClass(score: number) {
  if (score >= 90) return 'text-primary';
  if (score >= 75) return 'text-primary';
  if (score >= 60) return 'text-warning';
  if (score >= 40) return 'text-warning';
  return 'text-destructive';
}

export function FinancialHealthScoreCard() {
  const { total, classification, classificationColor, pillars, isLoading } = useFinancialHealthScore();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow group glass-card float-card border-border/30 h-full"
      onClick={() => navigate('/health-score')}
    >
      <CardContent className="p-5 min-h-[360px] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Score de Saúde Financeira</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </div>

        <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-5 text-center">
          <p className={`font-display font-bold tabular-nums text-5xl md:text-6xl leading-none ${getScoreToneClass(total)}`}>
            {total}
          </p>
          <p className="text-xs text-muted-foreground mt-1">de 100 pontos</p>
          <Badge
            variant="secondary"
            className="text-xs mt-3"
            style={{
              backgroundColor: `${classificationColor}20`,
              color: classificationColor,
              border: `1px solid ${classificationColor}40`,
            }}
          >
            {classification}
          </Badge>
        </div>

        <div className="space-y-2.5 mt-4">
          {pillars.map((p, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="text-xs text-muted-foreground w-36 truncate">{p.name}</span>
              <Progress
                value={(p.score / p.max) * 100}
                className="h-2 flex-1"
                style={{ '--progress-background': p.color } as CSSProperties}
              />
              <span className="text-xs font-semibold w-8 text-right">{p.score}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
