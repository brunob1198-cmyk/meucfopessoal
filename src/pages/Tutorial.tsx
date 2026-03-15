import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReactMarkdown from 'react-markdown';
import {
  DollarSign, FileText, FileBarChart, Target, LayoutDashboard,
  Sparkles, CalendarRange, Scale, Calculator, UserCircle,
  Send, Bot, User, ChevronDown, ChevronRight, Loader2, MessageCircleQuestion,
  Landmark, ArrowDownUp, Star, Heart, Activity
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
      `### Para que serve?
A tela de **Lançamentos** é o coração do sistema. É aqui que você registra **todas** as suas movimentações financeiras — receitas, despesas, custos, investimentos e descontos. Todos os relatórios (DRE, Dashboard, CFO Digital) se alimentam dos dados inseridos aqui. Sem lançamentos, as demais telas ficam vazias.`,

      `### Estrutura: Categorias e Subcategorias
O sistema organiza seus lançamentos em dois níveis:
- **Categoria Pai** (grupo): Ex: HABITAÇÃO, SAÚDE, AUTOMÓVEL. Aparece como um cartão com borda colorida à esquerda. Cada cor representa o tipo DRE (verde = receita, vermelho = despesa, azul = investimento, etc.).
- **Subcategoria** (item): Ex: Aluguel, Plano de Saúde, Combustível. É na subcategoria que você registra os valores.

**Exemplo prático:** Dentro da categoria pai "AUTOMÓVEL" você encontra subcategorias como Combustível, Seguro, IPVA, Mecânico, etc.`,

      `### Como criar categorias e subcategorias
- **Nova Categoria Pai**: Clique no botão **"Nova Categoria"** no canto superior direito. Informe o nome (ex: "EDUCAÇÃO DOS FILHOS") e selecione o tipo DRE (Receita, Despesa, Custo, Desconto, Investimento, Depreciação, Resultado Financeiro, Outras Receitas ou Impostos). O tipo DRE define onde essa categoria aparecerá no relatório DRE.
- **Nova Subcategoria**: Dentro de uma categoria pai, clique no botão **"+"**. Informe o nome (ex: "Escola particular"). A subcategoria herda automaticamente o tipo DRE da categoria pai.`,

      `### Como fazer um lançamento (passo a passo)
1. Localize a **subcategoria** desejada (ex: Combustível, dentro de AUTOMÓVEL).
2. Clique no **"+"** à direita da subcategoria para abrir o formulário.
3. Preencha os campos:
   - **Valor (R$)**: Digite o valor. Exemplo: \`650.00\`. Use valores **negativos** para estornos ou correções (ex: \`-50.00\` se precisar corrigir um lançamento a mais).
   - **Data**: Selecione a data do gasto/receita. O padrão é a data de hoje.
   - **Comentário** (opcional): Adicione uma nota para lembrar depois. Ex: "Abastecimento posto Shell BR-101".
4. Clique em **SALVAR**.

**Exemplo completo:** Você abasteceu o carro por R$ 280,00 no dia 05/03. Vá em AUTOMÓVEL → Combustível → "+", digite 280, selecione 05/03, comente "Posto Shell" e salve.`,

      `### Lançamentos parcelados
Para compras parceladas:
1. No formulário de lançamento, ative o switch **"Parcelado"**.
2. Informe o **valor total** da compra (ex: R$ 3.600,00).
3. Informe o **número de parcelas** (ex: 12).
4. O sistema divide automaticamente: R$ 3.600 ÷ 12 = R$ 300,00 por mês.
5. São criados 12 lançamentos automáticos, um para cada mês consecutivo, todos vinculados (com indicação de parcela: 1/12, 2/12, etc.).

**Importante:** O valor informado é o **total**, não o valor da parcela. O sistema faz a divisão.`,

      `### Ícones e ações nas subcategorias
Ao lado de cada subcategoria, você encontra ícones de ação:
- **✏️ Lápis**: Renomeia a subcategoria. Clique, edite o nome e confirme com Enter.
- **↔️ Setas (mover)**: Move a subcategoria para outra categoria pai. Um diálogo mostra as categorias disponíveis. Ao mover, o tipo DRE é atualizado automaticamente e todos os lançamentos existentes são preservados. Exemplo: mover "Farmácia" de HABITAÇÃO para SAÚDE.
- **🗑️ Lixeira**: Exclui a subcategoria **e todos os seus lançamentos permanentemente**. Use com cuidado — não há como desfazer.
- **➕ Plus**: Abre o formulário de lançamento rápido para aquela subcategoria.`,

      `### Ações nas categorias pai
- **✏️ Lápis**: Renomeia a categoria pai.
- **🗑️ Lixeira**: Exclui a categoria pai, **todas** as subcategorias dentro dela e **todos** os lançamentos vinculados. Ação irreversível.
- **Expandir/Recolher**: Clique no nome da categoria para mostrar ou ocultar suas subcategorias.`,

      `### Importação via Excel
Para importar múltiplos lançamentos de uma vez:
1. Clique em **"Importar Excel"** no canto superior direito.
2. **Baixe o modelo** clicando no link disponibilizado — ele já vem com o formato correto e uma aba com os nomes das categorias.
3. Preencha a planilha com:
   - **Data**: formato dd/mm/aaaa (ex: 05/03/2026)
   - **Categoria**: nome **exato** da subcategoria (ex: "Combustível", não "combustível" ou "Combustivel")
   - **Valor**: número (ex: 650.00)
   - **Comentário**: texto livre (opcional)
4. Faça upload do arquivo preenchido. O sistema valida os dados e importa tudo de uma vez.

**Dica:** Consulte a aba "Categorias" do modelo para copiar os nomes exatos e evitar erros de digitação.`,

      `### Limite do plano gratuito
- Usuários no plano gratuito têm um **limite mensal de lançamentos** (ex: 100/mês).
- O contador aparece abaixo do título: "45/100 lançamentos este mês".
- Ao atingir o limite, novos lançamentos são bloqueados até o próximo mês ou até fazer upgrade para Premium.

**Dica do Especialista:** Registre seus lançamentos semanalmente para não acumular e perder detalhes. Quanto mais lançamentos registrados, mais precisa será a análise do CFO Digital IA.`,
    ],
  },
  {
    icon: FileText,
    title: 'DRE Detalhado',
    route: '/dre',
    description: 'Demonstrativo de Resultado do Exercício completo, mês a mês.',
    details: [
      `### Para que serve?
O **DRE (Demonstrativo de Resultado do Exercício)** é o relatório financeiro mais importante do sistema. Ele organiza todas as suas receitas e despesas numa estrutura hierárquica padronizada — a mesma usada por empresas — para calcular indicadores como **Lucro Bruto**, **EBITDA** e **Resultado Líquido**. Com ele, você entende exatamente para onde seu dinheiro vai e quanto sobra (ou falta) no final de cada mês.`,

      `### Estrutura completa do DRE (de cima para baixo)
O relatório segue esta ordem fixa:
1. **RECEITA BRUTA** — Soma de todos os ganhos (salário, benefícios, rendas extras, freelances).
2. **(–) DESCONTOS INCIDENTES** — IR, INSS, ISS, descontos obrigatórios no contracheque.
3. **= RECEITA LÍQUIDA** — Receita Bruta menos Descontos. É o que efetivamente entra na sua conta.
4. **(–) CUSTOS** — Gastos diretamente ligados à geração de receita (ex: venda de VA com desconto).
5. **= LUCRO BRUTO** — Receita Líquida menos Custos. Quanto sobra antes das despesas do dia a dia.
6. **(–) DESPESAS** — Todas as despesas operacionais: habitação, saúde, automóvel, pessoais, restaurante, lazer, estudos. Investimentos também aparecem aqui.
7. **= EBITDA** — Lucro Bruto menos Despesas. Indicador-chave: mostra sua **capacidade real de gerar caixa** antes de depreciação e impostos sobre resultado.
8. **(–) DEPRECIAÇÃO** — Perda de valor de bens ao longo do tempo (ex: carro, equipamentos).
9. **= EBIT** — EBITDA menos Depreciação.
10. **(+/–) RESULTADO FINANCEIRO** — Juros pagos, taxas bancárias, rendimentos de investimentos.
11. **(+) OUTRAS RECEITAS** — Receitas não operacionais (venda de um bem, cashback).
12. **(–) IMPOSTOS** — Impostos sobre resultado.
13. **= RESULTADO LÍQUIDO** — O quanto **efetivamente** sobrou (ou faltou) no final. Se positivo, você está no azul; se negativo, gastou mais do que ganhou.

**Exemplo:** Se sua Receita Bruta é R$ 10.000, Descontos R$ 2.500, Custos R$ 200, Despesas R$ 5.800 → EBITDA = R$ 1.500. Isso significa que você gerou R$ 1.500 de caixa no mês.`,

      `### Como usar o filtro de período
- No topo da tela, selecione o **mês inicial** e o **mês final**.
- A tabela mostra uma **coluna por mês** dentro do intervalo selecionado.
- Para ver o ano inteiro, selecione Jan a Dez do ano desejado.
- **Dica:** Para análise de tendência, use pelo menos 6 meses consecutivos.`,

      `### Navegação na tabela
- **Categorias pai** (linhas com fundo colorido): Clique na seta para expandir e ver as subcategorias com seus valores mensais.
- **Botão ↕️ (Expandir/Recolher Todos)**: No canto superior, expande ou recolhe todas as categorias de uma vez — útil para ter uma visão geral ou detalhada rapidamente.
- **Subcategorias**: Aparecem indentadas dentro de cada categoria pai, mostrando o valor real de cada item por mês.`,

      `### Detalhamento de lançamentos (Lupa 🔍)
Este é um recurso poderoso para investigar de onde vem cada valor:
- **Lupa no nome da subcategoria** (coluna esquerda): Mostra **todos** os lançamentos daquela subcategoria no **período inteiro** selecionado.
- **Lupa no valor** (coluna de um mês específico): Mostra apenas os lançamentos daquele **mês específico**.
- No modal de detalhamento você vê: Data, Comentário e Valor de cada lançamento individual.
- **Editar comentário**: Passe o mouse sobre um lançamento e clique no ícone de lápis ✏️ para editar o comentário inline. Confirme com Enter ou ✓, cancele com Esc ou ✕.
- O **total** dos lançamentos aparece na última linha do modal.

**Exemplo:** Você vê que Combustível em março foi R$ 950 (acima do normal). Clique na lupa do valor de março para ver os 4 abastecimentos individuais e identificar qual foi o gasto extra.`,

      `### Projeções (valores em verde)
- Meses **futuros** que possuem projeções cadastradas no Planejador aparecem com valores em **cor verde**.
- Meses passados/atuais com dados reais aparecem em cor padrão (preto/branco).
- Isso permite **comparar visualmente** o realizado com o planejado no mesmo relatório.

**Exemplo:** Se você projetou R$ 650 de Combustível para abril no Planejador, esse valor aparece em verde na coluna de abril do DRE.`,

      `### Exportação
- Clique no **menu de exportação** (ícone no canto superior) para gerar:
  - **Excel (.xlsx)**: Planilha com todos os dados, ideal para análises customizadas.
  - **PDF**: Relatório formatado, ideal para impressão ou envio.
- O arquivo exportado mantém a mesma estrutura visual do DRE.

**Dica do Especialista:** Use o DRE Detalhado mensalmente para identificar categorias que estão crescendo acima do esperado. Compare pelo menos 3 meses consecutivos para identificar tendências reais (e não variações pontuais).`,
    ],
  },
  {
    icon: FileBarChart,
    title: 'DRE Ajustado',
    route: '/dre-ajustado',
    description: 'Versão simplificada e consolidada do DRE para visão executiva.',
    details: [
      `### Para que serve?
O **DRE Ajustado** é uma versão **resumida e executiva** do DRE Detalhado. Enquanto o Detalhado abre cada subcategoria, o Ajustado mostra apenas as **linhas totais** (Receita Bruta, Descontos, Receita Líquida, EBITDA, Resultado Líquido). É ideal para quem quer uma **visão rápida** da saúde financeira sem se perder nos detalhes.`,

      `### Diferenças em relação ao DRE Detalhado
| Característica | DRE Detalhado | DRE Ajustado |
|---|---|---|
| Subcategorias | Sim, expandíveis | Não, apenas totais |
| Margens percentuais | Não | Sim, em relação à Receita Bruta |
| Comparativo Real vs Projetado | Valores em verde | Lado a lado |
| Melhor para | Investigar detalhes | Visão executiva rápida |`,

      `### Como ler as margens percentuais
Cada linha de total mostra o **percentual em relação à Receita Bruta**:
- **Receita Líquida 75%** → Significa que 25% da sua receita bruta é consumida por descontos.
- **EBITDA 15%** → De cada R$ 100 que você ganha, R$ 15 viram caixa livre.
- **Resultado Líquido -5%** → Você está gastando 5% a mais do que ganha.

**Exemplo:** Receita Bruta R$ 10.000, EBITDA R$ 1.500 → Margem EBITDA = 15%. Se no mês seguinte cair para 10%, é um alerta de que seus gastos estão crescendo mais que sua receita.`,

      `### Comparativo Realizado vs Projetado
Quando há projeções cadastradas no Planejador, o DRE Ajustado exibe **dois valores lado a lado** para cada mês futuro:
- **Realizado**: O que efetivamente aconteceu (baseado nos lançamentos).
- **Projetado**: O que foi planejado.
- Desvios significativos ficam visualmente evidentes, permitindo ajuste rápido do planejamento.

**Dica do Especialista:** Acompanhe a margem EBITDA mês a mês. Se ela cair por 2-3 meses consecutivos, é hora de revisar seus gastos no DRE Detalhado para encontrar a causa.`,
    ],
  },
  {
    icon: Target,
    title: 'Planejador',
    route: '/planejador',
    description: 'Defina orçamentos e metas financeiras por categoria para meses futuros.',
    details: [
      `### Para que serve?
O **Planejador** é a ferramenta de **orçamento e projeção mensal**. Aqui você define quanto pretende gastar (ou receber) em cada subcategoria para cada mês futuro. Esses valores alimentam as projeções que aparecem em verde no DRE e no comparativo do Dashboard.

Diferente do Simulador (que projeta cenários de longo prazo), o Planejador foca no **orçamento operacional mês a mês**.`,

      `### Como preencher (passo a passo)
1. Selecione o **período** desejado usando o seletor de meses no canto superior (ex: Abr/2026 a Dez/2026).
2. A tabela mostra todas as suas subcategorias na **vertical** e os meses na **horizontal**.
3. **Clique em uma célula** para inserir ou editar o valor projetado.
4. O campo aceita qualquer valor numérico (ex: 650.00).
5. Para **remover** uma projeção, digite 0 (zero) — o registro é excluído.
6. As alterações ficam em **modo rascunho** (fundo destacado) até você clicar em **"Salvar"**.

**Exemplo:** Você quer projetar R$ 650 de Combustível para todos os meses do segundo semestre. Preencha a célula de Combustível × Jul com 650, e use o botão de replicar para copiar para Ago-Dez.`,

      `### Botão Replicar (ícone de copiar 📋)
Para evitar digitar o mesmo valor 12 vezes:
1. Clique no ícone de **copiar** ao lado da subcategoria.
2. Informe o **valor** a ser replicado (ex: 650).
3. Selecione o **período** (mês inicial e final).
4. Marque/desmarque meses individuais se necessário.
5. Clique em **"Replicar"**.
6. O sistema preenche todas as células selecionadas com o valor informado.

**Importante:** Se já havia valores anteriores (ex: 600), eles são **substituídos** pelo novo valor (650). Não há duplicação.`,

      `### Meses bloqueados (cadeado 🔒)
- Meses **passados e o mês atual** aparecem com ícone de cadeado e não podem ser editados.
- Apenas meses **futuros** são editáveis, já que o objetivo é planejar à frente.
- Se você precisa corrigir dados de meses passados, faça isso na tela de Lançamentos.`,

      `### Expandir/Recolher categorias
- Use as setas ao lado de cada categoria pai para expandir/recolher subcategorias.
- O botão **↕️** no topo expande ou recolhe todas de uma vez.
- O estado de expansão é **salvo automaticamente** — ao voltar à tela, as categorias que estavam abertas continuam abertas.`,

      `### O que o sistema entrega
- **Totais por categoria**: Cada linha de categoria pai soma automaticamente os valores das subcategorias.
- **Integração com DRE**: Os valores projetados aparecem em **verde** no DRE Detalhado para meses futuros.
- **Integração com Dashboard**: O gráfico "Realizado vs Projetado" usa esses dados.
- **Integração com CFO Digital**: A IA considera suas projeções na análise.

**Dica do Especialista:** Projete pelo menos 6 meses à frente. Use como base a **média dos últimos 3 meses** de cada subcategoria (visível no DRE Detalhado). Revise mensalmente após fechar o mês real e ajuste as projeções dos meses seguintes.`,
    ],
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    route: '/dashboard',
    description: 'Painel visual com gráficos e indicadores financeiros.',
    details: [
      `### Para que serve?
O **Dashboard** é o painel de controle visual do sistema. Transforma seus dados financeiros em **gráficos e indicadores** que permitem entender sua situação financeira em segundos, sem precisar analisar tabelas. É a primeira tela que você deve consultar para ter uma visão geral.`,

      `### KPIs (Indicadores-Chave) no topo
Os cards no topo mostram os números mais importantes do período selecionado:
- **Receita Total**: Soma de todas as receitas brutas. Exemplo: R$ 12.500,00.
- **Despesa Total**: Soma de todos os gastos (despesas + custos). Exemplo: R$ 9.800,00.
- **Resultado Líquido**: Receita menos todos os gastos. Se positivo (verde), você está no azul. Se negativo (vermelho), gastou mais do que ganhou.
- **Taxa de Economia**: Percentual da receita que sobrou. Exemplo: R$ 2.700 de R$ 12.500 = 21,6% de economia.

**Meta ideal:** Especialistas recomendam uma taxa de economia de pelo menos **20%** da receita líquida.`,

      `### Gráfico de Evolução Mensal
- Mostra a **evolução ao longo do tempo** de receitas, despesas e resultado líquido em linhas.
- Cada mês é um ponto no gráfico.
- **Como interpretar:** Se a linha de despesas está subindo enquanto a de receita está estável, você precisa agir. Se o resultado líquido está caindo mês a mês, é um alerta vermelho.

**Exemplo:** Jan +R$ 1.200, Fev +R$ 800, Mar +R$ 300, Abr –R$ 200 → Tendência clara de piora. Investigue no DRE Detalhado qual categoria está crescendo.`,

      `### Distribuição de Gastos por Categoria
- Gráfico que mostra **onde seu dinheiro é gasto**, com cada fatia representando uma categoria (Habitação 35%, Saúde 12%, Automóvel 15%, etc.).
- **Como interpretar:** Se uma categoria ocupa mais de 30-40% dos gastos totais, vale investigar se há espaço para redução.

**Exemplo:** Se Habitação consome 45% dos gastos, está acima do recomendado (ideal: até 30%). Analise no DRE Detalhado se há subcategorias que podem ser otimizadas.`,

      `### Comparativo Realizado vs Projetado
- Disponível quando há projeções cadastradas no Planejador.
- Mostra barras comparando o **planejado** com o **realizado** para cada mês.
- **Como interpretar:** Se o realizado supera o projetado consistentemente, suas projeções estão subestimadas e precisam de ajuste.

**Dica do Especialista:** Consulte o Dashboard no início de cada semana para manter o controle. Use o filtro de período para comparar o mês atual com os anteriores e identificar rapidamente se está dentro do orçamento planejado.`,
    ],
  },
  {
    icon: Sparkles,
    title: 'CFO Digital IA',
    route: '/inteligencia',
    description: 'Análise inteligente dos seus dados financeiros por inteligência artificial.',
    details: [
      `### Para que serve?
O **CFO Digital** usa **inteligência artificial** para analisar automaticamente todos os seus dados financeiros e gerar recomendações personalizadas. Funciona como um **consultor financeiro pessoal** que conhece cada detalhe dos seus gastos, receitas e projeções.`,

      `### Como usar (passo a passo)
1. Selecione o **período** que deseja analisar (padrão: últimos 12 meses). Quanto maior o período, mais contexto a IA tem para identificar tendências.
2. Clique em **"Gerar Análise"**.
3. Aguarde o processamento (a IA analisa seus lançamentos, categorias, projeções e indicadores).
4. O resultado aparece organizado em 4 seções:`,

      `### Seções da análise
- **💡 Insights** (3-5 itens): Análises sobre tendências, categorias que mais crescem, variações mensais e padrões de consumo. Incluem **números e percentuais concretos** dos seus dados reais. Exemplo: "Seus gastos com AUTOMÓVEL cresceram 23% nos últimos 3 meses, passando de R$ 1.200 para R$ 1.476."

- **⚠️ Alertas** (1-3 itens): Avisos sobre situações que requerem atenção. Só aparecem quando há algo relevante. Exemplo: "Sua taxa de economia caiu de 18% para 8% nos últimos 2 meses. Se a tendência continuar, você terá resultado negativo em maio."

- **✅ Sugestões** (3-4 itens): Recomendações acionáveis e específicas. Não são genéricas — são baseadas nos seus números. Exemplo: "Reduza gastos com LAZER em R$ 400/mês (de R$ 1.200 para R$ 800) para recuperar a meta de 20% de economia."

- **📈 Previsão** (próximos 3 meses): Projeção baseada no comportamento histórico, incluindo tendência (positiva/negativa/estável) e economia estimada se seguir as sugestões. Exemplo: "Seguindo as sugestões, você economizará R$ 4.800 adicionais nos próximos 6 meses."`,

      `### Histórico de análises
- Cada análise gerada é **salva automaticamente** no histórico.
- Você pode consultar análises anteriores clicando nelas na lista.
- O histórico mostra: data da geração, período analisado e resultado completo.
- **Compare análises** de meses diferentes para verificar se está evoluindo.

**Exemplo:** Na análise de janeiro a IA sugeriu reduzir Restaurante. Na análise de março, verifique se essa categoria efetivamente diminuiu.`,

      `### Dicas para melhores resultados
- **Quanto mais lançamentos**, mais precisa a análise. Registre tudo, inclusive gastos pequenos.
- **Gere análises mensalmente** para acompanhar evolução.
- **Cadastre projeções** no Planejador — a IA compara realizado vs projetado e avisa sobre desvios.
- Analise pelo menos **6 meses** para que a IA identifique tendências significativas (e não variações pontuais).

**Dica do Especialista:** Gere uma análise no início de cada mês, após fechar os lançamentos do mês anterior. Compare com a análise do mês passado para verificar se você seguiu as recomendações e qual foi o impacto real.`,
    ],
  },
  {
    icon: CalendarRange,
    title: 'Mapa de Compromissos',
    route: '/compromissos',
    description: 'Visão dos seus compromissos financeiros futuros.',
    details: [
      `### Para que serve?
O **Mapa de Compromissos** mostra todos os seus **compromissos financeiros futuros** — principalmente parcelas de compras parceladas. É essencial para planejar seu fluxo de caixa e evitar surpresas nos próximos meses. Antes de fazer uma nova compra parcelada, consulte esta tela para ver se cabe no orçamento.`,

      `### Como funciona
O sistema identifica automaticamente todos os lançamentos marcados como **"Parcelado"** que possuem parcelas futuras pendentes e organiza em uma visão mensal.

Para cada compromisso, você vê:
- **Subcategoria**: De onde vem o gasto (ex: Compras de itens).
- **Valor da parcela**: Quanto será desembolsado (ex: R$ 300,00).
- **Número da parcela**: Em qual parcela está (ex: 3/12 — terceira de doze).
- **Comentário**: A nota que você adicionou ao criar o lançamento (ex: "Geladeira nova").

**Exemplo:** Você parcelou uma geladeira em 12x de R$ 300 e um celular em 10x de R$ 250. O Mapa mostra que em julho você terá R$ 550 de compromissos fixos (parcela 5/12 da geladeira + parcela 3/10 do celular).`,

      `### Como usar para planejamento
1. **Identifique meses pesados**: Veja quais meses têm maior volume de compromissos acumulados.
2. **Compare com a receita**: Se os compromissos de um mês somam R$ 2.000 e sua receita líquida é R$ 7.500, sobram R$ 5.500 para despesas variáveis.
3. **Evite acumular**: Antes de parcelar uma nova compra, veja quanto já está comprometido nos próximos meses.
4. **Antecipe quando possível**: Se identificar um mês muito apertado no futuro, considere antecipar parcelas agora.

**Dica do Especialista:** Uma regra prática é que seus compromissos fixos (parcelas + aluguel + contas fixas) não devem ultrapassar **50% da receita líquida**. Use o Mapa de Compromissos junto com o Planejador para garantir que novos parcelamentos cabem no orçamento.`,
    ],
  },
  {
    icon: Scale,
    title: 'Balanço Patrimonial',
    route: '/balanco',
    description: 'Controle de ativos, passivos e patrimônio líquido.',
    details: [
      `### Para que serve?
O **Balanço Patrimonial** é uma "fotografia" do seu patrimônio em um dado momento. Enquanto o DRE mostra o **fluxo** mensal (quanto entra e sai), o Balanço mostra o **estoque** acumulado: tudo que você **possui** (ativos), tudo que você **deve** (passivos) e a diferença entre eles (**patrimônio líquido**).`,

      `### Como cadastrar ativos (o que você possui)
Clique em **"Novo Ativo"** e preencha:
- **Nome**: Identificação do bem. Ex: "Apartamento Centro", "Carro Civic 2023", "CDB Banco Inter".
- **Categoria**: Selecione entre:
  - Conta Corrente / Poupança / Dinheiro em Caixa (liquidez imediata)
  - Renda Fixa / Ações / Fundos / Criptomoedas (investimentos financeiros)
  - Imóveis / Veículos (bens físicos)
  - Participações (cotas em empresas)
  - Outros Bens
- **Valor Atual (R$)**: Valor de mercado estimado hoje. Ex: R$ 450.000 para um imóvel.
- **Data de Aquisição** (opcional): Quando comprou/adquiriu.
- **Observações** (opcional): Notas livres. Ex: "Financiado, saldo devedor no passivo".

**Exemplo completo:** Ativo "CDB Banco Inter", categoria "Renda Fixa", valor R$ 25.000, data 15/01/2025, obs "Vencimento em 2027, taxa 13% ao ano".`,

      `### Como cadastrar passivos (o que você deve)
Clique em **"Novo Passivo"** e preencha:
- **Nome**: Identificação da dívida. Ex: "Financiamento Apto", "Cartão Nubank".
- **Categoria**: Selecione entre:
  - Cartão de Crédito / Empréstimo / Financiamento Imobiliário / Financiamento Veicular / Parcelamento / Impostos a Pagar / Outros Passivos
- **Valor Total (R$)**: Valor total original da dívida. Ex: R$ 350.000.
- **Saldo Atual (R$)**: Quanto ainda falta pagar hoje. Ex: R$ 280.000.
- **Parcela Mensal (R$)**: Valor mensal. Ex: R$ 2.800.
- **Taxa de Juros (%)**: Taxa mensal ou anual. Ex: 0.75% ao mês.
- **Data Início / Data Fim**: Período do financiamento.
- **Observações** (opcional): Ex: "Sistema SAC, parcelas decrescentes".

**Exemplo completo:** Passivo "Financiamento Apto Centro", categoria "Financiamento Imobiliário", total R$ 350.000, saldo atual R$ 280.000, parcela R$ 2.800, juros 0.75%/mês, início 03/2022, fim 03/2052.`,

      `### Patrimônio Líquido
Calculado automaticamente: **Total de Ativos – Total de Passivos**.
- **Positivo**: Você possui mais do que deve. Ex: Ativos R$ 500.000 – Passivos R$ 280.000 = PL R$ 220.000.
- **Negativo**: Suas dívidas superam seus bens. Foco em quitação de passivos.
- **Acompanhe a evolução**: O objetivo é que o PL cresça mês a mês.`,

      `### Gráfico de evolução histórica
O sistema salva um **snapshot mensal** automático do seu patrimônio e exibe um gráfico com 3 linhas:
- **Total de Ativos** (azul): Deve crescer com aportes e valorização.
- **Total de Passivos** (vermelho): Deve diminuir com pagamentos.
- **Patrimônio Líquido** (verde): A diferença — deve subir consistentemente.

**Como interpretar:** Se o PL está caindo, significa que ou seus ativos estão desvalorizando ou seus passivos estão crescendo (novas dívidas). Investigue qual dos dois está causando a queda.

**Dica do Especialista:** Atualize os valores dos ativos e passivos pelo menos **uma vez por mês** (idealmente no mesmo dia, ex: dia 1). Para investimentos, atualize com o saldo real da corretora. Para imóveis, revise o valor estimado a cada 6 meses.`,
    ],
  },
  {
    icon: Calculator,
    title: 'Simulador Financeiro',
    route: '/simulador',
    description: 'Simulador de cenários financeiros futuros.',
    details: [
      `### Para que serve?
A ferramenta **Visão Futuro Financeiro** foi desenhada para ajudar você a projetar cenários e entender como suas decisões de hoje impactarão seu patrimônio e caixa nos próximos meses ou anos.

Diferente do Planejador (que foca em orçamento mensal), o Simulador é voltado para **projeções de longo prazo**.`,

      `### Como preencher os campos
Para realizar uma simulação precisa, configure os seguintes pilares:

**Cenário de Receita:**
- O que preencher: Informe sua estimativa de ganhos mensais (salários, pró-labore, rendas extras).
- Como: Você pode definir um valor fixo ou aplicar uma taxa de crescimento anual (ex: reajuste salarial esperado de 5%).

**Cenário de Despesas e Custos:**
- O que preencher: Seus gastos fixos (aluguel, internet) e variáveis (lazer, compras).
- Como: Pode-se projetar a manutenção do padrão atual ou simular aumentos de gastos (inflação pessoal) e reduções estratégicas.

**Investimentos e Aportes:**
- O que preencher: Quanto você pretende poupar/investir mensalmente.
- Como: Defina o valor do aporte mensal e a taxa de retorno esperada (ex: 0,8% ao mês ou 10% ao ano).

**Período da Projeção:**
- O que preencher: Escolha o horizonte de tempo (ex: 12 meses, 5 anos, 10 anos).`,

      `### O que o sistema entrega
- **Gráfico de Evolução**: Uma linha que mostra o crescimento (ou diminuição) do seu saldo e patrimônio ao longo do tempo.
- **Análise de Sustentabilidade**: O sistema indica se, com base nos gastos atuais e rentabilidade, seus investimentos serão suficientes para cobrir seu custo de vida no futuro (independência financeira).
- **Comparação de Cenários**: Você pode criar um "Cenário Otimista" (ganhando mais e gastando menos) e um "Cenário Conservador" para comparar os resultados.

**Exemplo:** Com receita de R$ 10.000, despesas de R$ 7.000 e aporte de R$ 2.500/mês a 1% ao mês, em 10 anos você acumula aproximadamente R$ 575.000 em investimentos.`,

      `**Dica do Especialista:** Use a Visão Futuro em conjunto com o **CFO Digital IA** para validar se as suas projeções são realistas com base no seu histórico real de gastos registrados na tela de Lançamentos. Simule pelo menos 3 cenários: pessimista, realista e otimista.`,
    ],
  },
  {
    icon: UserCircle,
    title: 'Meu Perfil',
    route: '/perfil',
    description: 'Configurações da sua conta, dados pessoais e compartilhamento.',
    details: [
      `### Para que serve?
A tela **Meu Perfil** é onde você configura suas preferências pessoais, personaliza a aparência do sistema e gerencia o compartilhamento dos seus dados com outras pessoas (cônjuge, contador, consultor financeiro).`,

      `### Informações Pessoais
A seção de **Informações Pessoais** permite cadastrar dados adicionais para personalizar sua experiência:
- **Nome de Exibição**: O nome que aparece no cabeçalho do sistema e nos relatórios exportados. Edite e clique em "Salvar Perfil".
- **Gênero**: Selecione entre Masculino, Feminino, Não-binário ou Prefiro não dizer. Campo opcional.
- **Data de Nascimento**: Informe sua data de nascimento. Campo opcional, útil para projeções de aposentadoria.
- **Profissão**: Informe sua profissão. Campo opcional, útil para contextualização nas análises de IA.

Todos os campos são opcionais. Clique em **"Salvar Perfil"** para gravar as alterações.`,

      `### Logo Personalizado
- Faça **upload de uma imagem** para personalizar o sistema com sua identidade visual.
- A logo aparece no **cabeçalho** (ao lado do nome) e nos **relatórios exportados** (PDF/Excel).
- **Formatos aceitos:** PNG, JPG, SVG.
- **Tamanho recomendado:** Imagem quadrada, mínimo 200x200 pixels.`,

      `### Compartilhamento de Acesso
Convide outras pessoas para acessar seus dados financeiros:
1. Clique em **"Convidar"**.
2. Informe o **e-mail** da pessoa (ela precisa ter conta no sistema).
3. Selecione a **permissão**:
   - **Visualização**: O convidado pode ver todos os seus relatórios e lançamentos, mas **não pode alterar nada**. Ideal para: cônjuge que quer acompanhar, contador que precisa consultar.
   - **Edição**: O convidado pode criar lançamentos e modificar dados. Ideal para: cônjuge que também registra gastos, assistente financeiro.
4. O convite fica como **"Pendente"** até a pessoa aceitar.
5. Você pode **revogar** o acesso a qualquer momento clicando no ícone de lixeira ao lado do convite.

**Dica do Especialista:** Se você usa um contador, compartilhe com permissão de **visualização**. Assim ele pode gerar relatórios e análises sem risco de alterar seus dados acidentalmente.`,
    ],
  },
  {
    icon: Star,
    title: 'Mapa de Sonhos Financeiros',
    route: '/mapa-sonhos',
    description: 'Vincule disciplina financeira a objetivos de vida concretos.',
    details: [
      `### Para que serve?
O **Mapa de Sonhos Financeiros** permite vincular sua disciplina financeira a **objetivos de vida concretos** — comprar uma casa, fazer uma viagem, conquistar a independência financeira. O sistema monitora automaticamente o progresso, calcula o esforço mensal necessário e prevê a data de conclusão.`,

      `### Como criar um sonho (passo a passo)
1. Clique em **"Novo Sonho"**.
2. Preencha:
   - **Nome do Sonho**: Identifique seu objetivo. Ex: "Viagem para Europa".
   - **Categoria**: Selecione entre as categorias pré-definidas (Casa Própria, Carro, Viagem, Cirurgia, Educação, Aposentadoria, Independência Financeira, Outro) ou clique em **"+ Nova Categoria"** para criar uma categoria personalizada com o nome que desejar.
   - **Valor Necessário (R$)**: Quanto custa realizar o sonho. Ex: R$ 25.000.
   - **Valor Acumulado (R$)**: Quanto já foi poupado. Ex: R$ 5.000.
   - **Data Desejada**: Quando pretende realizar. Ex: 12/2027.
   - **Descrição**: Observação opcional. Ex: "15 dias, 3 países".
3. Clique em **"Criar Sonho"**.`,

      `### Categorias personalizadas
Além das 8 categorias padrão, você pode criar **quantas categorias quiser**:
- Na tela de criação/edição de sonho, selecione **"+ Nova Categoria"** no dropdown.
- Digite o nome da nova categoria (ex: "Reforma", "Casamento", "Negócio Próprio").
- A nova categoria recebe automaticamente um ícone de estrela e uma cor diferenciada.
- Categorias personalizadas funcionam exatamente como as padrão em termos de acompanhamento e detecção.`,

      `### Status dos sonhos
O sistema calcula automaticamente o status de cada sonho:
- **Em Progresso** (azul): Acumulou menos de 75% do valor necessário e tem tempo adequado.
- **Próximo de Realizar** (verde): Acumulou 75% ou mais do valor necessário.
- **Em Risco** (laranja): Faltam 2 meses ou menos para a data desejada e o progresso está abaixo de 50%.
- **Concluído** (verde): Acumulou 100% ou mais do valor necessário, ou marcado manualmente.`,

      `### Recomendações automáticas
Para cada sonho com data definida, o sistema calcula automaticamente:
- **Valor mensal necessário**: Quanto poupar por mês para atingir o objetivo na data desejada.
- **Exemplo**: Faltam R$ 20.000 e 10 meses → "Poupe R$ 2.000/mês para alcançar esse sonho até Out de 2027."`,

      `### Detecção inteligente de conquistas
O sistema analisa seus lançamentos recentes e, quando encontra uma transação que pode corresponder à realização de um sonho (baseado em palavras-chave e valores próximos), exibe um banner de sugestão:
- "Parece que você realizou o sonho: **Viagem para Europa**"
- Clique em **"Concluir"** para confirmar e celebrar com animação de parabéns.

**Dica do Especialista:** Atualize o valor acumulado de cada sonho mensalmente. Use o resultado líquido positivo do DRE como base para decidir quanto alocar em cada sonho.`,
    ],
  },
  {
    icon: Activity,
    title: 'Score de Saúde Financeira',
    route: '/saude-financeira',
    description: 'Nota geral da sua saúde financeira com 5 indicadores-chave.',
    details: [
      `### Para que serve?
O **Score de Saúde Financeira** calcula uma nota de 0 a 100 para sua situação financeira, baseada em 5 pilares fundamentais:
1. **Capacidade de Poupança** — Quanto da sua receita você consegue guardar.
2. **Controle de Despesas** — Se seus gastos estão dentro de padrões saudáveis.
3. **Liquidez** — Se você tem ativos líquidos suficientes para emergências.
4. **Endividamento** — Proporção entre passivos e ativos.
5. **Reserva de Emergência** — Se possui pelo menos 6 meses de despesas em reserva.`,

      `### Como funciona
O score é calculado automaticamente com base nos seus dados do DRE (receitas e despesas) e do Balanço Patrimonial (ativos e passivos). Cada pilar recebe uma nota individual, e a média ponderada gera o score total.

- **80-100**: Excelente saúde financeira.
- **60-79**: Boa, com pontos de melhoria.
- **40-59**: Atenção necessária em alguns pilares.
- **0-39**: Situação crítica, priorize ações corretivas.`,

      `### Histórico
O sistema salva o score mensalmente, permitindo acompanhar a evolução ao longo do tempo. Um gráfico mostra a tendência — verifique se sua nota está subindo consistentemente.

**Dica do Especialista:** Foque no pilar com menor nota para obter o maior impacto. Geralmente, controlar despesas e construir reserva de emergência geram os ganhos mais rápidos.`,
    ],
  },
  {
    icon: Landmark,
    title: 'Contas Conectadas (Open Finance)',
    route: '/contas-conectadas',
    description: 'Sincronize contas bancárias e cartões via Open Finance para importação automática.',
    details: [
      `### Para que serve?
A tela **Contas Conectadas** permite vincular suas contas bancárias e cartões de crédito ao sistema via **Open Finance (Pluggy)**. Uma vez conectada, as transações são importadas automaticamente, eliminando a necessidade de lançamentos manuais.`,

      `### Como conectar uma conta (passo a passo)
1. Clique em **"Conectar Banco"**.
2. O sistema abre o widget do Pluggy, onde você:
   - Seleciona seu banco (ex: Nubank, Itaú, Bradesco).
   - Faz a autenticação com suas credenciais bancárias (os dados são criptografados e não ficam armazenados no sistema).
   - Autoriza o acesso.
3. Após a autorização, a conta aparece na lista com:
   - **Nome do banco/conector** e logo.
   - **Tipo da conta** (corrente, crédito, poupança).
   - **Saldo atual**.
   - **Data da última sincronização**.`,

      `### Sincronização de transações
- Clique em **"Sincronizar"** para importar as transações mais recentes de uma conta.
- O sistema aplica **categorização automática** em 3 níveis:
  1. **Regras personalizadas**: Se você já categorizou uma transação com determinada descrição, a mesma regra é aplicada automaticamente.
  2. **Regras padrão**: Palavras-chave conhecidas são mapeadas (ex: IFOOD → Alimentação, UBER → Transporte, NETFLIX → Assinaturas).
  3. **Revisão manual**: Transações sem regra ficam como "pendentes" para revisão na tela de Revisar Transações.`,

      `### Segurança
- **Credenciais bancárias** nunca são armazenadas no sistema — o acesso é feito exclusivamente via API Open Finance.
- A conexão pode ser **desconectada** a qualquer momento clicando no botão de desconectar.
- Todos os dados sensíveis são criptografados em trânsito e em repouso.

**Dica do Especialista:** Conecte todas as suas contas e cartões para ter uma visão financeira completa. Sincronize semanalmente para manter os dados atualizados e reduzir o acúmulo de transações para revisão.`,
    ],
  },
  {
    icon: ArrowDownUp,
    title: 'Revisar Transações',
    route: '/revisar-transacoes',
    description: 'Revise e confirme a categorização de transações importadas automaticamente.',
    details: [
      `### Para que serve?
A tela **Revisar Transações** é onde você valida as transações importadas via Open Finance antes que elas alimentem o DRE e os relatórios. Cada transação importada passa por aqui para garantir que a categorização esteja correta.`,

      `### Status das transações
- **Pendente**: Transação importada que ainda não foi revisada. Pode ter uma sugestão de categoria.
- **Confirmada**: Transação aprovada e já integrada ao DRE.
- **Ignorada**: Transação descartada (ex: transferências entre contas próprias que não devem afetar o DRE).`,

      `### Como revisar (passo a passo)
1. A tela mostra todas as transações pendentes com: data, descrição, valor e categoria sugerida.
2. Para cada transação, você pode:
   - **Confirmar** a categoria sugerida clicando em ✓.
   - **Alterar** a categoria selecionando outra no dropdown.
   - **Ignorar** clicando no botão de ignorar.
3. Ao alterar uma categoria, o sistema **salva automaticamente uma regra**: transações futuras com a mesma descrição receberão a mesma categoria.
4. Para processar em lote, use **"Confirmar Todas"** para aceitar todas as sugestões de uma vez.

**Exemplo:** A transação "PADARIA DO BAIRRO R$ 15,00" veio como "Sem categoria". Você seleciona "Alimentação" → a regra é salva → próximas compras na "PADARIA DO BAIRRO" serão categorizadas automaticamente.`,

      `### Integração com o DRE
Transações **confirmadas** são automaticamente convertidas em lançamentos no sistema e passam a alimentar:
- **DRE Detalhado e Ajustado**
- **Dashboard**
- **CFO Digital IA**
- **Mapa de Compromissos**

**Dica do Especialista:** Revise as transações pelo menos uma vez por semana. Quanto mais transações você categorizar corretamente, mais inteligente o sistema fica — as regras aprendidas reduzem drasticamente a necessidade de revisão futura.`,
    ],
  },
  {
    icon: Heart,
    title: 'Fluxo de Caixa',
    route: '/fluxo-caixa',
    description: 'Visão do fluxo de entrada e saída de caixa.',
    details: [
      `### Para que serve?
O **Fluxo de Caixa** oferece uma visão consolidada das entradas e saídas financeiras ao longo do tempo, complementando o DRE com foco na **movimentação real de dinheiro**.

**Dica do Especialista:** Use o Fluxo de Caixa em conjunto com o Mapa de Compromissos para antecipar meses em que o fluxo pode ficar negativo e tomar ações preventivas.`,
    ],
  },
  {
    icon: LayoutDashboard,
    title: 'Inteligência de Dados',
    route: '/inteligencia-dados',
    description: 'Análises avançadas e visualizações dos seus dados financeiros.',
    details: [
      `### Para que serve?
A tela **Inteligência de Dados** oferece análises visuais avançadas sobre seus dados financeiros, com gráficos interativos e comparativos que complementam o Dashboard principal com visões mais analíticas.

**Dica do Especialista:** Utilize a Inteligência de Dados para apresentações a consultores financeiros ou para análises trimestrais aprofundadas.`,
    ],
  },
];

const CHAT_HISTORY_KEY = 'tutorial-chat-history';

function loadChatHistory(): Msg[] {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveChatHistory(msgs: Msg[]) {
  try {
    // Keep last 50 messages to avoid localStorage bloat
    const toSave = msgs.slice(-50);
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(toSave));
  } catch {}
}

export default function Tutorial() {
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [messages, setMessages] = useState<Msg[]>(() => loadChatHistory());
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist chat history on change
  useEffect(() => {
    if (messages.length > 0) {
      saveChatHistory(messages);
    }
  }, [messages]);

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(CHAT_HISTORY_KEY);
  };

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
            Pergunte ao Big B
            {messages.length > 0 && (
              <Button variant="ghost" size="sm" className="ml-auto text-xs text-muted-foreground h-7" onClick={clearHistory}>
                Limpar histórico
              </Button>
            )}
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
