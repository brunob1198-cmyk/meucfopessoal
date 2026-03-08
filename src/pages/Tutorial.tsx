import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import ReactMarkdown from 'react-markdown';
import {
  DollarSign, FileText, FileBarChart, Target, LayoutDashboard,
  Sparkles, CalendarRange, Scale, Calculator, UserCircle,
  Send, Bot, User, ChevronDown, ChevronRight, Loader2, MessageCircleQuestion
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Msg = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tutorial-chat`;

const tutorialSections = [
  {
    icon: DollarSign,
    title: 'Lançamentos',
    route: '/',
    description: 'Tela principal para registrar todas as suas movimentações financeiras.',
    details: [
      '**Categorias e Subcategorias**: Crie categorias pai (ex: HABITAÇÃO) e subcategorias (ex: Aluguel, Condomínio) para organizar seus lançamentos.',
      '**Novo Lançamento**: Selecione a data, subcategoria, valor e opcionalmente um comentário.',
      '**Parcelamentos**: Marque "Parcelado" para dividir um valor em N meses — cada parcela é criada automaticamente.',
      '**Importação Excel**: Baixe o modelo de planilha, preencha e faça upload para importar lançamentos em massa.',
      '**Gerenciar Categorias**: Crie, edite ou exclua categorias. Ao excluir uma categoria, todos os lançamentos vinculados são removidos.',
    ],
  },
  {
    icon: FileText,
    title: 'DRE Detalhado',
    route: '/dre',
    description: 'Demonstrativo de Resultado do Exercício completo, mês a mês.',
    details: [
      '**Estrutura DRE**: Receita Bruta → Descontos → Receita Líquida → Custos → Lucro Bruto → Despesas → EBITDA → Resultado Financeiro → Resultado Líquido.',
      '**Expandir/Recolher**: Clique nas categorias para ver ou esconder as subcategorias.',
      '**Detalhamento (🔍)**: Clique na lupa de qualquer subcategoria para ver os lançamentos individuais e editar comentários.',
      '**Projeções**: Meses futuros com valores planejados aparecem em verde.',
      '**Exportação**: Exporte para Excel ou PDF usando o menu de exportação.',
    ],
  },
  {
    icon: FileBarChart,
    title: 'DRE Ajustado',
    route: '/dre-ajustado',
    description: 'Versão simplificada e consolidada do DRE para visão executiva.',
    details: [
      '**Visão Consolidada**: Mostra os principais indicadores sem o detalhamento por subcategoria.',
      '**Realizado vs Projetado**: Compara os valores reais com o que foi planejado.',
      '**Margens**: Exibe margens percentuais para análise rápida de rentabilidade.',
    ],
  },
  {
    icon: Target,
    title: 'Planejador',
    route: '/planejador',
    description: 'Defina orçamentos e metas financeiras por categoria para meses futuros.',
    details: [
      '**Projeções Mensais**: Defina valores esperados de receita e despesa para cada subcategoria em cada mês.',
      '**Integração com DRE**: Os valores planejados aparecem automaticamente no DRE Detalhado (em verde).',
      '**Controle Orçamentário**: Compare o realizado com o planejado para identificar desvios.',
    ],
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    route: '/dashboard',
    description: 'Painel visual com gráficos e indicadores financeiros.',
    details: [
      '**Evolução Mensal**: Gráficos de receitas, despesas e resultado ao longo do tempo.',
      '**Distribuição de Gastos**: Visualize onde seu dinheiro é gasto por categoria.',
      '**Comparativo**: Realizado vs planejado em formato visual.',
      '**KPIs**: Principais indicadores financeiros em destaque.',
    ],
  },
  {
    icon: Sparkles,
    title: 'CFO Digital IA',
    route: '/inteligencia',
    description: 'Análise inteligente dos seus dados financeiros por inteligência artificial.',
    details: [
      '**Insights Automáticos**: A IA analisa tendências, padrões de consumo e variações nos seus dados.',
      '**Alertas**: Receba avisos sobre gastos acima da média ou categorias fora do padrão.',
      '**Sugestões**: Recomendações acionáveis para otimizar seu fluxo financeiro.',
      '**Previsão**: Projeção de cenário baseada no comportamento histórico.',
      '**Histórico**: Todas as análises anteriores ficam salvas para consulta.',
    ],
  },
  {
    icon: CalendarRange,
    title: 'Mapa de Compromissos',
    route: '/compromissos',
    description: 'Visão dos seus compromissos financeiros futuros.',
    details: [
      '**Parcelas Futuras**: Veja todas as parcelas pendentes organizadas por mês.',
      '**Planejamento de Fluxo**: Antecipe quanto precisará desembolsar nos próximos meses.',
    ],
  },
  {
    icon: Scale,
    title: 'Balanço Patrimonial',
    route: '/balanco',
    description: 'Controle de ativos, passivos e patrimônio líquido.',
    details: [
      '**Ativos**: Registre contas bancárias, investimentos, imóveis, veículos e outros bens.',
      '**Passivos**: Registre empréstimos, financiamentos, cartões de crédito e parcelamentos.',
      '**Patrimônio Líquido**: Calculado automaticamente (Ativos - Passivos).',
      '**Evolução**: Acompanhe a evolução do seu patrimônio ao longo dos meses.',
    ],
  },
  {
    icon: Calculator,
    title: 'Visão Futuro Financeiro',
    route: '/simulador',
    description: 'Simulador de cenários financeiros futuros.',
    details: [
      '**Simulações**: Projete diferentes cenários de receita, despesa e investimento.',
      '**Cenários**: Compare cenários otimista, realista e pessimista.',
    ],
  },
  {
    icon: UserCircle,
    title: 'Meu Perfil',
    route: '/perfil',
    description: 'Configurações da sua conta e compartilhamento.',
    details: [
      '**Nome de Exibição**: Altere como seu nome aparece no sistema.',
      '**Logo Personalizado**: Faça upload de uma logo para personalizar seus relatórios.',
      '**Compartilhamento**: Convide outros usuários para visualizar ou editar seus dados.',
    ],
  },
];

export default function Tutorial() {
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Msg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';
    const allMessages = [...messages, userMsg];

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) throw new Error('Limite de requisições excedido. Tente novamente em alguns minutos.');
        if (resp.status === 402) throw new Error('Créditos insuficientes.');
        throw new Error('Falha ao conectar com o assistente.');
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantSoFar += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: 'assistant', content: assistantSoFar }];
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ ${e.message || 'Erro ao processar sua pergunta.'}` }]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tutorial & Ajuda</h1>
        <p className="text-muted-foreground mt-1">Conheça todas as funcionalidades do DRE Pessoal e tire suas dúvidas com a IA.</p>
      </div>

      {/* Tutorial sections */}
      <div className="grid gap-3">
        {tutorialSections.map((section, idx) => {
          const isExpanded = expandedSection === idx;
          const Icon = section.icon;
          return (
            <Card key={idx} className="overflow-hidden">
              <button
                onClick={() => setExpandedSection(isExpanded ? null : idx)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{section.title}</h3>
                  <p className="text-sm text-muted-foreground truncate">{section.description}</p>
                </div>
                {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              </button>
              {isExpanded && (
                <CardContent className="pt-0 pb-4 px-5 border-t border-border">
                  <div className="ml-12 space-y-2 mt-3">
                    {section.details.map((detail, dIdx) => (
                      <div key={dIdx} className="text-sm text-foreground leading-relaxed prose prose-sm max-w-none">
                        <ReactMarkdown>{detail}</ReactMarkdown>
                      </div>
                    ))}
                  </div>
                  <div className="ml-12 mt-3">
                    <span className="text-xs text-muted-foreground">Rota: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{section.route}</code></span>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* AI Q&A section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircleQuestion className="h-5 w-5 text-primary" />
            Pergunte ao Assistente
          </CardTitle>
          <p className="text-sm text-muted-foreground">Tire suas dúvidas sobre qualquer funcionalidade do sistema.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            ref={scrollRef}
            className={cn(
              'rounded-lg border border-border bg-muted/30 p-4 space-y-4 overflow-y-auto transition-all',
              messages.length > 0 ? 'min-h-[200px] max-h-[400px]' : 'min-h-[80px]'
            )}
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-4 text-muted-foreground text-sm gap-2">
                <Bot className="h-8 w-8 opacity-40" />
                <span>Faça uma pergunta sobre o aplicativo...</span>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="flex items-start mt-1 shrink-0">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                )}
                <div
                  className={cn(
                    'rounded-xl px-4 py-2.5 max-w-[85%] text-sm',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border text-foreground'
                  )}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="flex items-start mt-1 shrink-0">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex gap-2 items-center text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Pensando...</span>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="flex gap-2"
          >
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ex: Como faço para importar lançamentos por Excel?"
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {['Como funciona o parcelamento?', 'O que é o EBITDA?', 'Como compartilhar meus dados?'].map((q) => (
              <button
                key={q}
                onClick={() => { setInput(q); inputRef.current?.focus(); }}
                className="text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted transition-colors text-muted-foreground"
              >
                {q}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
