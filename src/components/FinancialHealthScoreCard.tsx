import { useFinancialHealthScore } from '@/hooks/useFinancialHealthScore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, HeartPulse, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function MiniScoreCircle({ score }: { score: number }) {
  const size = 72;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 90 ? 'hsl(152, 60%, 40%)' :
    score >= 75 ? 'hsl(152, 50%, 48%)' :
    score >= 60 ? 'hsl(38, 92%, 50%)' :
    score >= 40 ? 'hsl(25, 90%, 52%)' :
    'hsl(0, 72%, 51%)';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} stroke="hsl(var(--muted))" strokeWidth={strokeWidth} fill="transparent" />
        <circle cx={size/2} cy={size/2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="transparent"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold">{score}</span>
      </div>
    </div>
  );
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
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Score de Saúde Financeira</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </div>

        <div className="flex items-center gap-4">
          <MiniScoreCircle score={total} />
          <div className="flex-1 min-w-0">
            <Badge
              variant="secondary"
              className="text-xs mb-2"
              style={{
                backgroundColor: `${classificationColor}20`,
                color: classificationColor,
                border: `1px solid ${classificationColor}40`,
              }}
            >
              {classification}
            </Badge>
            <div className="space-y-1.5">
              {pillars.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-28 truncate">{p.name}</span>
                  <Progress
                    value={(p.score / p.max) * 100}
                    className="h-1.5 flex-1"
                    style={{ '--progress-background': p.color } as any}
                  />
                  <span className="text-xs font-medium w-6 text-right">{p.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
