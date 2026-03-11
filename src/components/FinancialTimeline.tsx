import { useMemo, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTransactions } from '@/hooks/useTransactions';
import { formatBRL } from '@/lib/dre';
import { format, isToday, isYesterday, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  DollarSign, CreditCard, ShoppingCart, TrendingUp, Briefcase,
  Home, Car, Utensils, Zap, Heart, GraduationCap, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  const scrollRef = useRef<HTMLDivElement>(null);

  const events = useMemo(() => {
    if (!transactions) return [];
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20);
  }, [transactions]);

  const weekCount = useMemo(() => {
    return events.filter((e) => differenceInDays(new Date(), parseISO(e.date)) <= 7).length;
  }, [events]);

  const isIncome = (dreType?: string) => dreType === 'receita' || dreType === 'outras_receitas';

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  };

  return (
    <Card className="glass-card float-card border-border/30 relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-display">Financial Timeline</CardTitle>
            <CardDescription className="text-xs mt-0.5">Atividades financeiras recentes</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {weekCount > 0 && (
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                {weekCount} atividade{weekCount > 1 ? 's' : ''} essa semana
              </Badge>
            )}
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => scroll('left')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => scroll('right')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <div className="relative">
          {/* Horizontal line */}
          <div className="absolute left-0 right-0 top-[18px] h-px bg-border/60 z-0" />

          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin"
            style={{ scrollbarWidth: 'thin' }}
          >
            {events.map((event, i) => {
              const dreType = event.categories?.dre_type || 'despesa';
              const config = DRE_TYPE_CONFIG[dreType] || DRE_TYPE_CONFIG.despesa;
              const catName = event.categories?.name || 'Outros';
              const Icon = getCategoryIcon(catName);
              const income = isIncome(dreType);
              const badge = getDateBadge(event.date);
              const isSelected = selectedId === event.id;

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.3 }}
                  className="flex flex-col items-center shrink-0 cursor-pointer group relative"
                  style={{ minWidth: 140, maxWidth: 160 }}
                  onClick={() => setSelectedId(isSelected ? null : event.id)}
                >
                  {/* Circle on the line */}
                  <div
                    className="w-[10px] h-[10px] rounded-full border-2 mb-2 z-10 transition-transform group-hover:scale-125"
                    style={{
                      borderColor: config.color,
                      backgroundColor: isSelected ? config.color : 'hsl(var(--background))',
                    }}
                  />

                  {/* Card below the line */}
                  <div
                    className="rounded-lg p-3 w-full transition-colors hover:bg-accent/40 text-center"
                    style={{ background: isSelected ? 'hsl(var(--accent) / 0.5)' : undefined }}
                  >
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center mx-auto mb-1.5"
                      style={{ background: `${config.color}20` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: config.color }} />
                    </div>

                    <p className="text-[11px] font-medium truncate">{event.comment || catName}</p>

                    <p className="text-sm font-bold tabular-nums mt-0.5" style={{ color: config.color }}>
                      {income ? '+' : '-'}{formatBRL(Math.abs(event.amount))}
                    </p>

                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {format(parseISO(event.date), "dd MMM", { locale: ptBR })}
                    </p>

                    {badge && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 mt-1 border-muted-foreground/30 text-muted-foreground">
                        {badge}
                      </Badge>
                    )}

                    {/* Expanded details */}
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 pt-2 border-t border-border/30 text-[10px] text-left space-y-1">
                            <div>
                              <span className="text-muted-foreground">Categoria</span>
                              <p className="font-medium">{catName}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Data Pgto.</span>
                              <p className="font-medium">{format(parseISO(event.payment_date), "dd/MM/yyyy")}</p>
                            </div>
                            {event.is_installment && (
                              <div>
                                <span className="text-muted-foreground">Parcela</span>
                                <p className="font-medium">{event.installment_number}/{event.total_installments}</p>
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

            {events.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8 w-full">
                Nenhuma atividade financeira registrada
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
