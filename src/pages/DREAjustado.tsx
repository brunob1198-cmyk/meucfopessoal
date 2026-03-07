import { useState } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { computeDREAjustado, formatBRL, DRELine } from '@/lib/dre';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function DREAjustado() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const start = format(startOfMonth(new Date(month + '-01')), 'yyyy-MM-dd');
  const end = format(endOfMonth(new Date(month + '-01')), 'yyyy-MM-dd');

  const { data: transactions, isLoading: txLoading } = useTransactions(start, end);
  const { data: categories, isLoading: catLoading } = useCategories();

  const loading = txLoading || catLoading;
  const lines = transactions && categories ? computeDREAjustado(transactions as any, categories) : [];

  const monthLabel = format(new Date(month + '-01'), "MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">DRE Ajustado</h1>
          <p className="text-sm text-muted-foreground capitalize">{monthLabel}</p>
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Descrição</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Valor (R$)</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">%</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr
                    key={i}
                    className={`border-b border-border/50 ${
                      line.isTotal ? 'bg-muted/40 font-semibold' : ''
                    }`}
                  >
                    <td className="py-3 px-4">{line.label}</td>
                    <td className={`text-right py-3 px-4 tabular-nums ${line.value < 0 ? 'text-destructive' : ''}`}>
                      {formatBRL(line.value)}
                    </td>
                    <td className="text-right py-3 px-4 tabular-nums text-muted-foreground">
                      {line.percent.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
