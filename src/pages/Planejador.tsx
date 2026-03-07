import { useState } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories, buildCategoryTree } from '@/hooks/useCategories';
import { computeDREAjustado, formatBRL } from '@/lib/dre';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function Planejador() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const start = format(startOfMonth(new Date(month + '-01')), 'yyyy-MM-dd');
  const end = format(endOfMonth(new Date(month + '-01')), 'yyyy-MM-dd');

  const { data: transactions, isLoading: txLoading } = useTransactions(start, end);
  const { data: categories, isLoading: catLoading } = useCategories();

  const loading = txLoading || catLoading;
  const realLines = transactions && categories ? computeDREAjustado(transactions as any, categories) : [];

  // Simple projected values (user can customize)
  const [projectedValues, setProjectedValues] = useState<Record<string, number>>({});

  const handleProjectedChange = (label: string, value: string) => {
    setProjectedValues((prev) => ({ ...prev, [label]: Number(value) || 0 }));
  };

  const monthLabel = format(new Date(month + '-01'), "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Planejador</h1>
          <p className="text-sm text-muted-foreground capitalize">Real vs Projetado — {monthLabel}</p>
        </div>
        <Input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-44"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Descrição</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Real (R$)</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Projetado (R$)</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {realLines.map((line, i) => {
                    const projected = projectedValues[line.label] ?? 0;
                    const diff = line.value - projected;
                    return (
                      <tr
                        key={i}
                        className={`border-b border-border/50 ${
                          line.isTotal ? 'bg-muted/40 font-semibold' : ''
                        }`}
                      >
                        <td className="py-2 px-4">{line.label}</td>
                        <td className="text-right py-2 px-4 tabular-nums">
                          {formatBRL(line.value)}
                        </td>
                        <td className="text-right py-2 px-4">
                          {!line.isTotal ? (
                            <Input
                              type="number"
                              className="w-28 ml-auto text-right h-8"
                              value={projectedValues[line.label] ?? ''}
                              onChange={(e) => handleProjectedChange(line.label, e.target.value)}
                              placeholder="0,00"
                              step="0.01"
                            />
                          ) : (
                            <span className="tabular-nums">{formatBRL(projected)}</span>
                          )}
                        </td>
                        <td
                          className={`text-right py-2 px-4 tabular-nums ${
                            diff > 0 ? 'text-[hsl(var(--chart-receita))]' : diff < 0 ? 'text-destructive' : ''
                          }`}
                        >
                          {projected > 0 ? formatBRL(diff) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
