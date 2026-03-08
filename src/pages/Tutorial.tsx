import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
      `### Visão Geral
Esta é a tela central do sistema. Aqui você registra **todas** as suas receitas, despesas, custos e investimentos. A organização é feita por **categorias pai** (grupos como HABITAÇÃO, SAÚDE, AUTOMÓVEL) e **subcategorias** (itens específicos como Aluguel, Plano de Saúde, Combustível).`,

      `### Estrutura de Categorias
- **Categoria Pai**: Grupo principal que aparece como um cartão com borda colorida à esquerda. Cada cor representa um tipo DRE diferente (verde = receita, vermelho = despesa, etc.).
- **Subcategoria**: Itens dentro de cada categoria pai. É na subcategoria que você faz os lançamentos.
- **Botão "Nova Categoria"** (canto superior direito): Cria uma nova categoria pai. Você define o nome e o tipo DRE (Receita, Despesa, Custo, Desconto, Investimento, etc.).
- **Botão "+" dentro de uma categoria**: Cria uma nova subcategoria dentro daquela categoria pai.`,

      `### Como Fazer um Lançamento
1. Clique no nome da **subcategoria** desejada para abrir o formulário.
2. **Valor (R$)**: Digite o valor. Use valor **negativo** para estornos ou correções.
3. **Data**: Selecione a data do lançamento (padrão: data atual).
4. **Comentário** (opcional): Adicione uma observação para identificar o lançamento depois.
5. **Parcelado**: Ative o switch para dividir o valor em parcelas. Informe o número de parcelas (2 a 60). O sistema cria automaticamente um lançamento por mês, dividindo o valor total igualmente.
6. Clique em **SALVAR** para confirmar.`,

      `### Ações nas Subcategorias (ícones à direita)
- **✏️ Lápis**: Renomeia a subcategoria inline.
- **↔️ Setas**: Move a subcategoria para outra categoria pai. Um diálogo permite escolher o novo destino — o tipo DRE é atualizado automaticamente e todos os lançamentos são mantidos.
- **🗑️ Lixeira**: Exclui a subcategoria. **Atenção**: todos os lançamentos vinculados também são excluídos permanentemente (cascata).
- **➕ Plus**: Abre o formulário de lançamento rápido.`,

      `### Ações nas Categorias Pai
- **✏️ Lápis**: Renomeia a categoria.
- **🗑️ Lixeira**: Exclui a categoria e **todas** as suas subcategorias e lançamentos.
- **Expandir/Recolher**: Clique no nome para mostrar ou esconder as subcategorias.`,

      `### Importação via Excel
- Clique no botão **"Importar Excel"** no canto superior direito.
- **Baixe o modelo** disponibilizado para garantir o formato correto.
- Preencha: **Data** (dd/mm/aaaa), **Categoria** (nome exato da subcategoria), **Valor** (número) e **Comentário** (opcional).
- Consulte a aba "Categorias" do modelo para ver os nomes exatos disponíveis.
- Faça upload do arquivo preenchido. O sistema valida e importa todos os lançamentos de uma vez.`,

      `### Limite do Plano Gratuito
- Usuários no plano gratuito têm um limite mensal de lançamentos.
- O contador aparece abaixo do título (ex: "45/100 lançamentos este mês").
- Ao atingir o limite, novos lançamentos são bloqueados até o próximo mês ou upgrade para Premium.`,
    ],
  },
  {
    icon: FileText,
    title: 'DRE Detalhado',
    route: '/dre',
    description: 'Demonstrativo de Resultado do Exercício completo, mês a mês.',
    details: [
      `### Visão Geral
O DRE (Demonstrativo de Resultado do Exercício) é um relatório financeiro que mostra sua "saúde financeira" mês a mês. Ele organiza suas receitas e despesas em uma estrutura hierárquica padronizada para calcular indicadores como Lucro Bruto, EBITDA e Resultado Líquido.`,

      `### Estrutura Completa do DRE
A tabela segue esta ordem de cima para baixo:
1. **RECEITA BRUTA** — Soma de todas as receitas (salário, benefícios, rendas extras).
2. **(-) DESCONTOS INCIDENTES** — IR, INSS, descontos obrigatórios.
3. **= RECEITA LÍQUIDA** — Receita Bruta menos Descontos.
4. **(-) CUSTOS** — Custos diretamente ligados à geração de receita.
5. **= LUCRO BRUTO** — Receita Líquida menos Custos.
6. **(-) DESPESAS** — Todas as despesas operacionais (habitação, saúde, automóvel, pessoais, restaurante, lazer, estudos) e investimentos.
7. **= EBITDA** — Lucro Bruto menos Despesas. Indicador-chave da sua capacidade de gerar caixa.
8. **(-) DEPRECIAÇÃO** — Perda de valor de bens ao longo do tempo.
9. **= EBIT** — EBITDA menos Depreciação.
10. **(+/-) RESULTADO FINANCEIRO** — Juros, taxas bancárias, rendimentos financeiros.
11. **(+) OUTRAS RECEITAS** — Receitas não operacionais.
12. **(-) IMPOSTOS** — Impostos sobre resultado.
13. **= RESULTADO LÍQUIDO** — O quanto sobrou (ou faltou) no final.`,

      `### Filtro de Período
- No topo da tela, selecione o **mês inicial** e **mês final** para definir o intervalo exibido.
- A tabela mostra uma coluna por mês dentro do período selecionado.`,

      `### Navegação na Tabela
- **Categorias pai** (linhas com fundo colorido): Clique para expandir e ver as subcategorias.
- **Botão ↕️**: Expande ou recolhe todas as categorias de uma vez.
- **Subcategorias**: Aparecem indentadas dentro de cada categoria pai.`,

      `### Detalhamento de Lançamentos (Lupa 🔍)
- Em cada **subcategoria**, aparece um ícone de lupa (🔍).
- **Lupa no nome** (coluna esquerda): Mostra **todos** os lançamentos daquela subcategoria no período inteiro.
- **Lupa no valor** (coluna do mês): Mostra apenas os lançamentos daquele **mês específico**.
- No modal de detalhamento você vê: Data, Comentário e Valor de cada lançamento.
- **Editar comentário**: Passe o mouse sobre um lançamento e clique no ícone de lápis para editar o comentário inline. Confirme com Enter ou ✓, cancele com Esc ou ✕.
- O total dos lançamentos é exibido na última linha.`,

      `### Projeções (valores em verde)
- Meses **futuros** que possuem projeções cadastradas no Planejador aparecem com valores em **cor verde**.
- Isso permite comparar visualmente o que foi realizado (preto) com o que foi planejado (verde).`,

      `### Exportação
- Use o **menu de exportação** para gerar arquivos Excel (.xlsx) ou PDF com os dados da tabela.
- O arquivo exportado mantém a mesma estrutura visual do DRE.`,
    ],
  },
  {
    icon: FileBarChart,
    title: 'DRE Ajustado',
    route: '/dre-ajustado',
    description: 'Versão simplificada e consolidada do DRE para visão executiva.',
    details: [
      `### Visão Geral
O DRE Ajustado é uma versão **resumida** do DRE Detalhado. Ele mostra apenas as linhas totais (Receita Bruta, Descontos, Receita Líquida, etc.) sem abrir por subcategoria. Ideal para uma **visão executiva rápida**.`,

      `### Diferenças do DRE Detalhado
- **Sem subcategorias**: Mostra apenas os totais de cada grupo.
- **Margens percentuais**: Cada linha de total mostra o percentual em relação à Receita Bruta, facilitando análise de proporção.
- **Comparativo Realizado vs Projetado**: Quando há projeções, exibe ambos os valores lado a lado.`,

      `### Filtro de Período
- Funciona igual ao DRE Detalhado: selecione mês inicial e final.
- A tabela mostra uma coluna por mês.`,

      `### Exportação
- Também possui menu de exportação para Excel e PDF.`,
    ],
  },
  {
    icon: Target,
    title: 'Planejador',
    route: '/planejador',
    description: 'Defina orçamentos e metas financeiras por categoria para meses futuros.',
    details: [
      `### Visão Geral
O Planejador permite definir **orçamentos e projeções** para cada subcategoria em cada mês futuro. É a ferramenta de planejamento financeiro que alimenta os valores "projetados" que aparecem no DRE.`,

      `### Como Usar
1. Selecione o **período** desejado (mês inicial e final).
2. A tabela mostra todas as suas subcategorias na vertical e os meses na horizontal.
3. **Clique em uma célula** para inserir ou editar o valor projetado para aquela subcategoria naquele mês.
4. Os valores são salvos automaticamente.`,

      `### Integração com Outras Telas
- Os valores definidos aqui aparecem **em verde** no DRE Detalhado para meses futuros.
- O Dashboard usa esses dados para o gráfico **Realizado vs Projetado**.
- O CFO Digital IA leva em conta as projeções na sua análise de cenário.`,

      `### Dicas de Uso
- Projete pelo menos 3-6 meses à frente para ter uma boa visão de planejamento.
- Use os valores médios dos últimos meses como base para suas projeções.
- Revise mensalmente e ajuste conforme a realidade.`,
    ],
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    route: '/dashboard',
    description: 'Painel visual com gráficos e indicadores financeiros.',
    details: [
      `### Visão Geral
O Dashboard apresenta seus dados financeiros em formato **visual e interativo**. Gráficos, indicadores e comparativos permitem entender rapidamente sua situação financeira.`,

      `### Gráfico de Evolução Mensal
- Mostra a **evolução ao longo do tempo** de receitas, despesas e resultado líquido.
- Cada mês é um ponto no gráfico, permitindo identificar tendências de melhora ou piora.`,

      `### Distribuição de Gastos por Categoria
- Gráfico de pizza ou barras mostrando **onde seu dinheiro é gasto**.
- Cada fatia representa uma categoria de despesa (Habitação, Saúde, etc.) com seu percentual.`,

      `### Comparativo Realizado vs Projetado
- Se você cadastrou projeções no Planejador, o Dashboard exibe um gráfico comparando o que foi **planejado** com o que foi **realizado**.
- Desvios significativos ficam visualmente evidentes.`,

      `### KPIs (Indicadores-Chave)
- **Receita Total**: Soma de todas as receitas no período.
- **Despesa Total**: Soma de todas as despesas.
- **Resultado Líquido**: Quanto sobrou (ou faltou).
- **Taxa de Economia**: Percentual da receita que foi poupada.`,

      `### Filtro de Período
- Selecione o intervalo de meses para ajustar todos os gráficos e indicadores.`,
    ],
  },
  {
    icon: Sparkles,
    title: 'CFO Digital IA',
    route: '/inteligencia',
    description: 'Análise inteligente dos seus dados financeiros por inteligência artificial.',
    details: [
      `### Visão Geral
O CFO Digital usa **inteligência artificial** para analisar automaticamente todos os seus dados financeiros e gerar recomendações personalizadas. Funciona como um consultor financeiro pessoal.`,

      `### Como Funciona
1. Selecione o **período** que deseja analisar (ou use o padrão dos últimos 12 meses).
2. Clique em **"Gerar Análise"**.
3. A IA processa seus lançamentos, categorias e projeções.
4. O resultado é apresentado em 4 seções:`,

      `### Seções da Análise
- **💡 Insights**: 3-5 análises sobre tendências, categorias que mais crescem, variações mensais e padrões de consumo. Inclui números e percentuais concretos dos seus dados.
- **⚠️ Alertas**: 1-3 avisos sobre gastos acima da média, categorias fora do padrão ou redução de receita. Só aparecem se houver algo relevante.
- **✅ Sugestões**: 3-4 recomendações acionáveis — como reduzir despesas específicas, redistribuir orçamento ou melhorar o fluxo de caixa.
- **📈 Previsão**: Projeção para os próximos 3 meses baseada no comportamento histórico, incluindo tendência (positiva/negativa/estável) e economia estimada se seguir as sugestões.`,

      `### Histórico de Análises
- Cada análise gerada é **salva automaticamente** no histórico.
- Você pode consultar análises anteriores para comparar a evolução das recomendações ao longo do tempo.
- O histórico mostra data, período analisado e o resultado completo.`,

      `### Dicas
- Quanto mais lançamentos registrados, mais precisa será a análise.
- Gere análises mensalmente para acompanhar a evolução.
- Compare as sugestões com as análises anteriores para verificar progresso.`,
    ],
  },
  {
    icon: CalendarRange,
    title: 'Mapa de Compromissos',
    route: '/compromissos',
    description: 'Visão dos seus compromissos financeiros futuros.',
    details: [
      `### Visão Geral
O Mapa de Compromissos mostra todos os seus **compromissos financeiros futuros** — principalmente parcelas de compras parceladas. É essencial para planejar seu fluxo de caixa nos próximos meses.`,

      `### Como Funciona
- O sistema identifica automaticamente todos os lançamentos marcados como **"Parcelado"** que possuem parcelas futuras.
- Organiza por mês, mostrando quanto você precisará desembolsar em cada período.
- Cada compromisso mostra: subcategoria, valor da parcela, número da parcela (ex: 3/12) e comentário.`,

      `### Planejamento de Fluxo
- Use esta tela para **antecipar** os meses com maior volume de compromissos.
- Compare com sua receita projetada para identificar meses apertados.
- Considere renegociar parcelas ou adiantar pagamentos quando possível.`,
    ],
  },
  {
    icon: Scale,
    title: 'Balanço Patrimonial',
    route: '/balanco',
    description: 'Controle de ativos, passivos e patrimônio líquido.',
    details: [
      `### Visão Geral
O Balanço Patrimonial é uma "fotografia" do seu patrimônio em um dado momento. Ele registra tudo que você **possui** (ativos), tudo que você **deve** (passivos) e calcula seu **patrimônio líquido** (a diferença).`,

      `### Ativos (o que você possui)
Registre bens e direitos organizados por categoria:
- **Conta Corrente / Poupança / Dinheiro em Caixa**: Saldos em contas bancárias e dinheiro físico.
- **Renda Fixa / Ações / Fundos / Criptomoedas**: Investimentos financeiros com valor atualizado.
- **Imóveis**: Valor de mercado estimado de propriedades.
- **Veículos**: Valor atual de carros, motos, etc.
- **Participações**: Cotas em empresas ou sociedades.
- **Outros Bens**: Qualquer outro ativo de valor.
Para cada ativo, informe: **Nome**, **Categoria**, **Valor Atual**, **Data de Aquisição** (opcional) e **Observações** (opcional).`,

      `### Passivos (o que você deve)
Registre dívidas e obrigações por categoria:
- **Cartão de Crédito**: Fatura atual do cartão.
- **Empréstimo**: Empréstimos pessoais ou consignados.
- **Financiamento Imobiliário / Veicular**: Saldo devedor de financiamentos.
- **Parcelamento**: Compras parceladas em aberto.
- **Impostos a Pagar**: Tributos pendentes.
- **Outros Passivos**: Outras dívidas.
Para cada passivo, informe: **Nome**, **Categoria**, **Valor Total**, **Saldo Atual**, **Parcela Mensal**, **Taxa de Juros**, **Data Início/Fim** e **Observações**.`,

      `### Patrimônio Líquido
- Calculado automaticamente: **Total de Ativos - Total de Passivos**.
- Se positivo, significa que você possui mais do que deve.
- Se negativo, indica que suas dívidas superam seus bens.`,

      `### Histórico de Evolução
- O sistema salva um **snapshot mensal** do seu patrimônio.
- Um gráfico mostra a **evolução ao longo dos meses** de: Total de Ativos, Total de Passivos e Patrimônio Líquido.
- Permite identificar se seu patrimônio está crescendo ou diminuindo.`,
    ],
  },
  {
    icon: Calculator,
    title: 'Visão Futuro Financeiro',
    route: '/simulador',
    description: 'Simulador de cenários financeiros futuros.',
    details: [
      `### Visão Geral
O Simulador Financeiro permite projetar **cenários futuros** com base nos seus dados atuais. Você pode alterar variáveis como receita, despesas e investimentos para ver o impacto no seu resultado.`,

      `### Como Usar
1. O simulador carrega seus **dados médios** recentes como ponto de partida.
2. Ajuste os valores de receita, despesas ou investimentos conforme o cenário desejado.
3. O sistema recalcula automaticamente os resultados projetados.`,

      `### Cenários
- **Otimista**: Aumento de receita e/ou redução de despesas.
- **Realista**: Manutenção dos padrões atuais.
- **Pessimista**: Redução de receita e/ou aumento de despesas.
Compare os três para entender sua faixa de possibilidades financeiras.`,

      `### Dicas
- Use o simulador antes de tomar decisões financeiras importantes (mudança de emprego, compra de imóvel, etc.).
- Teste diferentes cenários de investimento para encontrar o equilíbrio ideal.`,
    ],
  },
  {
    icon: UserCircle,
    title: 'Meu Perfil',
    route: '/perfil',
    description: 'Configurações da sua conta e compartilhamento.',
    details: [
      `### Visão Geral
Tela de configurações pessoais da sua conta no sistema.`,

      `### Nome de Exibição
- Altere o nome que aparece no sistema e nos relatórios.
- Clique no campo, edite e salve.`,

      `### Logo Personalizado
- Faça **upload de uma imagem** (logo) para personalizar a aparência do sistema.
- A logo aparece no cabeçalho e nos relatórios exportados.
- Formatos aceitos: PNG, JPG, SVG.`,

      `### Compartilhamento de Acesso
- Convide outros usuários (por e-mail) para **visualizar ou editar** seus dados financeiros.
- **Permissão de Visualização**: O convidado pode ver seus relatórios, mas não pode alterar nada.
- **Permissão de Edição**: O convidado pode criar lançamentos e modificar dados.
- Gerencie convites pendentes e acesso ativo nesta seção.
- Você pode revogar o acesso a qualquer momento.`,
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
        <p className="text-muted-foreground mt-1">Tire suas dúvidas com a IA ou explore os tutoriais detalhados abaixo.</p>
      </div>

      {/* AI Q&A section — now at the top */}
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
            {['Como funciona o parcelamento?', 'O que é o EBITDA?', 'Como compartilhar meus dados?', 'Como mover uma subcategoria?', 'Como importar pelo Excel?'].map((q) => (
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

      {/* Tutorial sections */}
      <h2 className="text-lg font-semibold text-foreground">Tutoriais Detalhados por Tela</h2>
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
                <CardContent className="pt-0 pb-5 px-5 border-t border-border">
                  <div className="ml-12 space-y-3 mt-4">
                    {section.details.map((detail, dIdx) => (
                      <div key={dIdx} className="text-sm text-foreground leading-relaxed prose prose-sm max-w-none dark:prose-invert [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mt-2 [&_h3]:mb-1">
                        <ReactMarkdown>{detail}</ReactMarkdown>
                      </div>
                    ))}
                  </div>
                  <div className="ml-12 mt-4">
                    <span className="text-xs text-muted-foreground">Rota: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{section.route}</code></span>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
