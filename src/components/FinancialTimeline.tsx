import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTransactions } from '@/hooks/useTransactions';
import { formatBRL } from '@/lib/dre';
import { format, isToday, isYesterday, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DollarSign, CreditCard, ShoppingCart, TrendingUp, Briefcase,
  Home, Car, Utensils, Zap, Heart, GraduationCap, X
} from 'lucide-react';

const DRE_TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  receita: { color: 'hsl(152, 60%, 42%)', label: 'Receita' },
  desconto: { color: 'hsl(0, 55%, 50%)', label: 'Desconto' },
  custo: { color: 'hsl(0, 55%, 50%)', label: 'Custo' },
  despesa: { color: 'hsl(0, 55%, 50%)', label: 'Despesa' },
  investimento: { color: 'hsl(210, 55%, 50%)', label: 'Investimento' },
  resultado_financeiro: { color: 'hsl(210, 55%, 50%)', label: 'Resultado Fin.' },
  outras_receitas: { color: 'hsl(152, 60%, 42%)', label: 'Outras Receitas' },
  depreciacao: { color: 'hsl(30, 50%, 45%)', label: 'Depreciação' },
  impostos: { color: 'hsl(0, 55%, 50%)', label: 'Impostos' },
};

const CATEGORY_ICONS: Record<string, any> = {
  salário: DollarSign, salario: DollarSign, renda: DollarSign,
  cartão: CreditCard, cartao: CreditCard, crédito: CreditCard,
  mercado: ShoppingCart, supermercado: ShoppingCart, alimentação: Utensils, alimentacao: Utensils,
  investimento: TrendingUp, aplicação: TrendingUp, aporte: TrendingUp,
  trabalho: Briefcase, empresa: Briefcase,
  moradia: Home, aluguel: Home, casa: Home, imóvel: Home,
  veículo: Car, carro: Car, transporte: Car,
  energia: Zap, luz: Zap, internet: Zap,
  saúde: Heart, saude: Heart, plano: Heart,
  educação: GraduationCap, educacao: GraduationCap, curso: GraduationCap,
};

function getCategoryIcon(name: string) {
  const lower = name.toLowerCase();
  for (const [key, Icon] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key)) return Icon;
  }
  return DollarSign;
}

function getDateBadge(dateStr: string): string | null {
  const date = parseISO(dateStr);
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  if (differenceInDays(new Date(), date) <= 7) return 'Essa semana';
  return null;
}

export function FinancialTimeline() {
  const { data: transactions } = useTransactions();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const events = useMemo(() => {
    if (!transactions) return [];
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);
  }, [transactions]);

  const weekCount = useMemo(() => {
    return events.filter((e) => {
      const diff = differenceInDays(new Date(), parseISO(e.date));
      return diff <= 7;
    }).length;
  }, [events]);

  const isIncome = (dreType?: string) => dreType === 'receita' || dreType === 'outras_receitas';

  const selected = selectedId ? events.find((e) => e.id === selectedId) : null;

  return (
    <Card className="glass-card float-card border-border/30 relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-display">Financial Timeline</CardTitle>
            <CardDescription className="text-xs mt-0.5">Atividades financeiras recentes</CardDescription>
          </div>
          {weekCount > 0 && (
            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
              {weekCount} atividade{weekCount > 1 ? 's' : ''} essa semana
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <ScrollArea className="h-[380px] pr-2">
          <div className="relative pl-6">
            {/* Vertical line */}
            <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border/60" />

            <AnimatePresence>
              {events.map((event, i) => {
                const dreType = event.categories?.dre_type || 'despesa';
                const config = DRE_TYPE_CONFIG[dreType] || DRE_TYPE_CONFIG.despesa;
                const catName = event.categories?.name || 'Outros';
                const Icon = getCategoryIcon(catName);
                const income = isIncome(dreType);
                const badge = getDateBadge(event.date);

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.35 }}
                    className="relative mb-3 last:mb-0 group cursor-pointer"
                    onClick={() => setSelectedId(selectedId === event.id ? null : event.id)}
                  >
                    {/* Circle indicator */}
                    <div
                      className="absolute -left-6 top-3 w-[10px] h-[10px] rounded-full border-2 transition-transform group-hover:scale-125"
                      style={{
                        borderColor: config.color,
                        backgroundColor: selectedId === event.id ? config.color : 'hsl(var(--background))',
                      }}
                    />

                    <div className="rounded-lg p-3 transition-colors hover:bg-accent/40"
                      style={{ background: selectedId === event.id ? 'hsl(var(--accent) / 0.5)' : undefined }}>
                      <div className="flex items-center gap-3">
                        <div
                          className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: `${config.color}20` }}
                        >
                          <Icon className="h-4 w-4" style={{ color: config.color }} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {event.comment || catName}
                            </span>
                            {badge && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-muted-foreground/30 text-muted-foreground shrink-0">
                                {badge}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-muted-foreground">
                              {format(parseISO(event.date), "dd MMM yyyy", { locale: ptBR })}
                            </span>
                            <Badge
                              className="text-[9px] px-1.5 py-0 border-0"
                              style={{ background: `${config.color}20`, color: config.color }}
                            >
                              {config.label}
                            </Badge>
                          </div>
                        </div>

                        <span
                          className="text-sm font-bold tabular-nums shrink-0"
                          style={{ color: config.color }}
                        >
                          {income ? '+' : '-'}{formatBRL(Math.abs(event.amount))}
                        </span>
                      </div>

                      {/* Expanded details */}
                      <AnimatePresence>
                        {selectedId === event.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 pt-3 border-t border-border/30 grid grid-cols-2 gap-2 text-[11px]">
                              <div>
                                <span className="text-muted-foreground">Categoria</span>
                                <p className="font-medium">{catName}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Data Pgto.</span>
                                <p className="font-medium">
                                  {format(parseISO(event.payment_date), "dd/MM/yyyy")}
                                </p>
                              </div>
                              {event.is_installment && (
                                <div>
                                  <span className="text-muted-foreground">Parcela</span>
                                  <p className="font-medium">{event.installment_number}/{event.total_installments}</p>
                                </div>
                              )}
                              {event.comment && (
                                <div className="col-span-2">
                                  <span className="text-muted-foreground">Observação</span>
                                  <p className="font-medium">{event.comment}</p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {events.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">
                Nenhuma atividade financeira registrada
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
