import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReactMarkdown from 'react-markdown';
import {
  DollarSign, FileText, FileBarChart, Target, LayoutDashboard,
  Banknote, HeartPulse, Sparkles, CalendarRange, Scale, Calculator, UserCircle,
  Send, Bot, User, ChevronDown, ChevronRight, Loader2, MessageCircleQuestion,
  Star
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Msg = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tutorial-chat`;

// Ordem igual à barra lateral (src/components/AppSidebar.tsx), para o tutorial
// seguir a mesma sequência de navegação que o usuário já usa no dia a dia.
const tutorialSections = [
  {
    icon: DollarSign,
    title: 'Lançamentos',
    route: '/',
    description: 'Tela principal para registrar todas as suas movimentações financeiras.',
    details: [
      `### Para que serve?
A tela de **Lançamentos** é o coração do sistema. É aqui que você registra **todas** as suas movimentações financeiras — receitas, despesas, custos, investimentos e descontos. Todos os relatórios (DRE, Dashboard, Consultor Financeiro IA) se alimentam dos dados inseridos aqui. Sem lançamentos, as demais telas ficam vazias.`,

      `### Estrutura: Categorias e Subcategorias
O sistema organiza seus lançamentos em dois níveis:
- **Categoria Pai** (grupo): Ex: HABITAÇÃO, SAÚDE, AUTOMÓVEL. Aparece como um cartão com borda colorida à esquerda. Cada cor representa o tipo DRE (verde = receita, vermelho = despesa, azul = investimento, etc.).
- **Subcategoria** (item): Ex: Aluguel, Plano de Saúde, Combustível. É na subcategoria que você registra os valores — não é possível lançar diretamente numa categoria pai.

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
   - **Data de pagamento diferente** (opcional): ative para informar uma data de vencimento/pagamento diferente da data do lançamento — útil quando a compra é de um dia mas o débito só acontece depois. O Fluxo de Caixa usa essa data para saber quando o dinheiro realmente sai; o DRE usa a data do lançamento.
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

**Importante:** O valor informado é o **total**, não o valor da parcela. O sistema faz a divisão. Todas as parcelas compartilham a mesma data de competência (a data da compra) — é a data de pagamento de cada parcela que avança mês a mês. Por isso, no DRE (que olha a data da compra) o valor total aparece de uma vez no mês da compra, enquanto no Fluxo de Caixa (que olha a data de pagamento) cada parcela aparece no seu próprio mês.`,

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
Para importar múltiplos lançamentos de uma vez a partir de uma planilha:
1. Clique em **"Importar Excel"** no canto superior direito.
2. **Baixe o modelo** clicando no link disponibilizado — ele já vem com o formato correto e uma aba com os nomes das categorias.
3. Preencha a planilha com:
   - **Data**: formato dd/mm/aaaa (ex: 05/03/2026)
   - **Categoria**: nome **exato** da subcategoria (ex: "Combustível", não "combustível" ou "Combustivel")
   - **Valor**: número (ex: 650.00). O sistema entende pontos e vírgulas automaticamente.
   - **Comentário**: texto livre (opcional)
4. Faça upload do arquivo preenchido. O sistema valida os dados e exibe a tela de revisão.
5. Na tela de revisão, use a caixa de seleção **"Marcar/Desmarcar todos"** para aprovar lançamentos em massa.

**Dica:** Consulte a aba "Categorias" do modelo para copiar os nomes exatos e evitar erros de digitação.`,

      `### Importação de Extrato Bancário
Diferente do Excel (que exige uma planilha no formato do sistema), aqui você importa o **extrato original do seu banco**:
1. Clique em **"Importar Extrato"**.
2. Selecione o arquivo exportado do seu banco/cartão nos formatos **CSV** ou **OFX**. Arquivos em **PDF não são aceitos** — o sistema avisa para exportar/salvar o extrato como CSV direto no site do banco.
3. O sistema tenta **classificar automaticamente** cada transação pela descrição, usando palavras-chave (ex: "ifood", "uber eats" → Alimentação; "posto", "shell", "ipiranga" → Combustível; "netflix", "spotify" → Assinaturas; "farmacia", "drogasil" → Farmácia — e várias outras).
4. O sistema também **detecta duplicatas**: se uma transação do extrato já bate com data + valor + descrição de um lançamento que você já tem, ela vem desmarcada e sinalizada, para você não importar o mesmo gasto duas vezes.
5. Na tela de revisão você pode **buscar, filtrar, ordenar** as linhas, trocar a categoria sugerida de qualquer transação (individualmente ou em lote, selecionando várias e aplicando uma categoria de uma vez) e desmarcar o que não quiser importar.
6. Clique em **"Importar X transação(ões)"** para confirmar.

**O sistema aprende com você:** toda vez que você troca manualmente a categoria sugerida de uma transação, essa correção é salva como uma regra nova (baseada na primeira palavra da descrição). Da próxima vez que você importar um extrato com uma transação parecida, a categoria certa já vem sugerida automaticamente — o sistema fica mais preciso a cada importação.`,

      `### Limite do plano gratuito
- Usuários no plano gratuito têm um limite de **100 lançamentos por mês**.
- O contador aparece abaixo do título: "45/100 lançamentos este mês".
- Ao atingir o limite, novos lançamentos são bloqueados até o próximo mês ou até fazer upgrade para Premium.

**Dica do Especialista:** Registre seus lançamentos semanalmente para não acumular e perder detalhes. Quanto mais lançamentos registrados, mais precisa será a análise do Consultor Financeiro IA.`,
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
2. **(–) DESCONTOS** — IR, INSS, ISS, descontos obrigatórios no contracheque, ou qualquer categoria que você tenha criado com tipo "Desconto".
3. **= RECEITA LÍQUIDA** — Receita Bruta menos Descontos. É o que efetivamente entra na sua conta.
4. **(–) CUSTOS** — Gastos diretamente ligados à geração de receita.
5. **= LUCRO BRUTO** — Receita Líquida menos Custos. Quanto sobra antes das despesas do dia a dia.
6. **(–) DESPESAS** — Todas as despesas operacionais: habitação, saúde, automóvel, pessoais, restaurante, lazer, estudos. **Investimentos também entram aqui** (o sistema trata aporte em investimento como uma redução do resultado do período, do mesmo jeito que uma despesa).
7. **= EBITDA** — Lucro Bruto menos Despesas. Indicador-chave: mostra sua **capacidade real de gerar caixa** antes de depreciação e impostos sobre resultado.
8. **(–) DEPRECIAÇÃO** — Perda de valor de bens ao longo do tempo (ex: carro, equipamentos).
9. **= EBIT** — EBITDA menos Depreciação.
10. **(+/–) RESULTADO FINANCEIRO** — Juros pagos e tarifas bancárias entram como redução; rendimentos de investimentos entram como acréscimo. O sistema sabe diferenciar os dois pela categoria: se o nome da categoria-pai de Resultado Financeiro contém "despesa" (ex: "Despesas Financeiras"), ela é tratada como saída; caso contrário (ex: "Receitas Financeiras"), como entrada.
11. **(+) OUTRAS RECEITAS** — Receitas não operacionais (venda de um bem, cashback).
12. **(–) IMPOSTOS** — Impostos sobre resultado.
13. **= LUCRO LÍQUIDO** — O quanto **efetivamente** sobrou (ou faltou) no final. Se positivo, você está no azul; se negativo, gastou mais do que ganhou.

**Exemplo:** Se sua Receita Bruta é R$ 10.000, Descontos R$ 2.500, Custos R$ 200, Despesas R$ 5.800 → EBITDA = R$ 1.500. Isso significa que você gerou R$ 1.500 de caixa no mês.`,

      `### Como usar o filtro de período e Expansão Semanal
- No topo da tela, selecione o **mês inicial** e o **mês final**.
- A tabela mostra uma **coluna por mês** dentro do intervalo selecionado.
- Para ver o ano inteiro, selecione Jan a Dez do ano desejado.
- **Visão Semanal:** passe o mouse e clique no botão de seta ">" ao lado do título de cada mês para expandir 5 subcolunas (S1 a S5), distribuindo os lançamentos daquele mês por faixas de ~7 dias — útil para achar rapidamente em qual semana um gasto aconteceu.
- **Dica:** Para análise de tendência, use pelo menos 6 meses consecutivos.`,

      `### Navegação na tabela
- **Categorias pai** (linhas com fundo colorido): Clique na seta para expandir e ver as subcategorias com seus valores mensais.
- **Botão ↕️ (Expandir/Recolher Todos)**: No canto superior, expande ou recolhe todas as categorias de uma vez — útil para ter uma visão geral ou detalhada rapidamente.
- **Subcategorias**: Aparecem indentadas dentro de cada categoria pai, mostrando o valor real de cada item por mês.`,

      `### Detalhamento e edição de lançamentos (Lupa 🔍)
Este é um recurso poderoso para investigar e ajustar de onde vem cada valor:
- **Lupa no nome da subcategoria** (coluna esquerda): Mostra **todos** os lançamentos daquela subcategoria no **período inteiro** selecionado.
- **Lupa no valor** (coluna de um mês específico): Mostra apenas os lançamentos daquele **mês específico**.
- No modal você vê Data, Comentário e Valor de cada lançamento, com o total na última linha.
- **Editar (ícone de lápis)**: abre um mini-formulário para alterar **Data, Valor e Comentário** juntos — confirme com o botão Salvar ou cancele.
- **Excluir (ícone de lixeira)**: remove o lançamento, com uma confirmação antes de excluir de fato.
- **Novo Lançamento**: dentro do próprio modal, use o botão **"Novo Lançamento"** para cadastrar um gasto ou receita direto naquela categoria, sem precisar voltar para a tela de Lançamentos — inclusive com opção de parcelamento e de data de pagamento diferente, exatamente como no formulário principal.

**Exemplo:** Você vê que Combustível em março foi R$ 950 (acima do normal). Clique na lupa do valor de março para ver os 4 abastecimentos individuais e identificar qual foi o gasto extra.`,

      `### Projeções (valores em verde)
- Meses **futuros** que possuem projeções cadastradas no Planejador aparecem com valores em **cor verde**.
- Meses passados/atuais com dados reais aparecem em cor padrão (preto/branco).
- Isso permite **comparar visualmente** o realizado com o planejado no mesmo relatório.
- Se você já lançou um valor real numa categoria de um mês futuro (por exemplo, pelo "Novo Lançamento" da lupa), esse lançamento real **substitui** a projeção daquela categoria/mês em vez de somar com ela — o sistema sempre prioriza o dado real quando ele existe.

**Exemplo:** Se você projetou R$ 650 de Combustível para abril no Planejador, esse valor aparece em verde na coluna de abril do DRE. Se depois você lançar um gasto real de R$ 700 de Combustível em abril, o DRE passa a mostrar R$ 700 (o real), não R$ 1.350.`,

      `### Exportação
- Clique no **menu de exportação** (ícone no canto superior) para gerar:
  - **Excel (.xlsx)**: Planilha com todos os dados, ideal para análises customizadas.
  - **PDF**: Relatório formatado, ideal para impressão ou envio.
- O arquivo exportado respeita quais categorias estão expandidas/recolhidas na hora da exportação.

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
O **DRE Ajustado** é uma versão **resumida e executiva** do DRE Detalhado. Em vez de abrir cada subcategoria, ele mostra sempre as mesmas **15 linhas de totais** (Receita Bruta, Descontos, Receita Líquida, Custos, Lucro Bruto, Despesas, EBITDA, Depreciação, EBIT, Resultado Financeiro, Outras Receitas, LAIR, Impostos, Lucro Líquido e Margem Líquida %). É ideal para quem quer uma **visão rápida** da saúde financeira sem se perder nos detalhes.`,

      `### Diferenças em relação ao DRE Detalhado
- **Subcategorias**: DRE Detalhado mostra todas, expandíveis; DRE Ajustado mostra só as 15 linhas de totais.
- **Margens percentuais**: só o DRE Ajustado mostra, em cada linha, em relação à Receita Bruta.
- **Meses futuros com projeção**: no DRE Detalhado, real e projeção não se sobrepõem na mesma categoria; no DRE Ajustado, o mês aparece com um único valor, marcado/colorido como "projetado".
- **Edição/exclusão de lançamentos**: só pela lupa do DRE Detalhado — o DRE Ajustado é somente leitura.
- **Melhor para**: DRE Detalhado para investigar detalhes e editar lançamentos; DRE Ajustado para uma visão executiva rápida, mês a mês ou o ano inteiro.

**Atenção:** o total de "Despesas" do DRE Ajustado hoje considera só a categoria Despesa (sem incluir Investimento, diferente do DRE Detalhado) — por isso, em meses com aporte em investimento, o EBITDA e o Lucro Líquido mostrados aqui podem vir ligeiramente diferentes dos mesmos números no DRE Detalhado para o mesmo período. Se notar essa diferença, o DRE Detalhado é a referência mais completa.`,

      `### Como ler as margens percentuais
Cada linha de total mostra o **percentual em relação à Receita Bruta**:
- **Receita Líquida 75%** → Significa que 25% da sua receita bruta é consumida por descontos.
- **EBITDA 15%** → De cada R$ 100 que você ganha, R$ 15 viram caixa livre.
- **Lucro Líquido -5%** → Você está gastando 5% a mais do que ganha.

**Exemplo:** Receita Bruta R$ 10.000, EBITDA R$ 1.500 → Margem EBITDA = 15%. Se no mês seguinte cair para 10%, é um alerta de que seus gastos estão crescendo mais que sua receita.`,

      `### Meses futuros e projeção
Quando um mês está no futuro, sua coluna aparece com uma cor diferente e uma etiqueta "projetado" — é um **único valor por mês**, já somando o que for real com o que ainda é projeção do Planejador (não é uma comparação lado a lado entre dois números). Para comparar realizado vs. projetado célula a célula, use o DRE Detalhado, que mostra os valores em verde quando vêm de projeção.

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
O **Planejador** é a ferramenta de **orçamento e projeção mensal**. Aqui você define quanto pretende gastar (ou receber) em cada subcategoria para cada mês futuro. Esses valores alimentam as projeções que aparecem em verde no DRE e no Dashboard.

Diferente do Simulador Financeiro (que projeta décadas à frente com base em médias reais), o Planejador foca no **orçamento operacional mês a mês**, categoria por categoria.`,

      `### Como preencher (passo a passo)
1. Selecione o **período** desejado usando o seletor de meses no canto superior (ex: Abr/2026 a Dez/2026).
2. A tabela mostra as categorias-pai (linhas em negrito, com o **total automático** das subcategorias — não editável) e, ao expandir, as subcategorias na vertical, com os meses na horizontal.
3. **Clique diretamente numa célula de subcategoria** para digitar o valor projetado. Não é preciso abrir nenhum diálogo — é um campo de valor direto na tabela.
4. Cada célula também tem um pequeno ícone de balão para adicionar um **comentário** sobre aquela projeção específica (ex: "inclui viagem de fim de ano").
5. Para **remover** uma projeção, digite 0 (zero) — o registro é excluído.
6. As alterações ficam em **modo rascunho** (destacado visualmente) até você clicar em **"Salvar"** — nada é gravado antes disso.

**Exemplo:** Você quer projetar R$ 650 de Combustível para julho. Clique na célula de Combustível × Jul, digite 650 e depois clique em Salvar.`,

      `### Botão Sugerir (varinha mágica ✨)
Ao lado do botão Salvar, o botão **"Sugerir"** preenche automaticamente as projeções com base na **média dos últimos 3 meses fechados** de cada categoria — ótimo ponto de partida para não começar do zero. Escolha quais categorias/meses recebem a sugestão; os valores preenchidos ficam marcados com a observação "Sugestão baseada na média dos últimos 3 meses" e continuam editáveis normalmente antes de salvar.`,

      `### Botão Replicar (ícone de copiar 📋)
Para evitar digitar o mesmo valor em vários meses:
1. Clique no ícone de **copiar** ao lado da subcategoria.
2. Informe o **valor** a ser replicado (ex: 650) e, se quiser, um comentário.
3. Selecione o **período** (mês inicial e final) — o sistema lembra o último período usado.
4. Marque/desmarque meses individuais se necessário, ou use "Selecionar todos".
5. Clique em **"Replicar"**.
6. O sistema preenche todos os meses selecionados com o valor informado.

**Importante:** Se já havia valores anteriores nesses meses, eles são **substituídos** pelo novo valor. Não há duplicação, e apenas meses futuros são efetivamente preenchidos.`,

      `### Meses bloqueados (cadeado 🔒)
- Meses **passados e o mês atual** aparecem com ícone de cadeado e não podem ser editados.
- Apenas meses **estritamente futuros** são editáveis, já que o objetivo é planejar à frente.
- Se você precisa corrigir dados de meses passados, faça isso na tela de Lançamentos.`,

      `### Expandir/Recolher categorias
- Use as setas ao lado de cada categoria pai para expandir/recolher subcategorias.
- O botão **↕️** no topo expande ou recolhe todas de uma vez.
- O estado de expansão é **salvo automaticamente** — ao voltar à tela, as categorias que estavam abertas continuam abertas.

**Dica do Especialista:** Projete pelo menos 6 meses à frente. Use o botão "Sugerir" como ponto de partida e ajuste manualmente onde souber de algo diferente (ex: uma viagem, uma compra grande). Revise mensalmente após fechar o mês real.`,
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
Os 4 cards no topo mostram, para o período selecionado, os mesmos números-chave do DRE:
- **Receita Líquida**: Receita Bruta menos Descontos.
- **Despesas**: Todas as despesas operacionais (inclui investimentos, mesmo critério do DRE).
- **EBITDA**: Lucro Bruto menos Despesas — sua capacidade de gerar caixa no período.
- **Lucro Líquido**: O resultado final do período, depois de depreciação, resultado financeiro, outras receitas e impostos. Aparece em vermelho quando negativo.

Esses 4 números batem exatamente com os mesmos totais do DRE Detalhado para o período selecionado.`,

      `### Alertas do Big B
Logo abaixo dos KPIs, quando houver algo relevante, aparece um card de **alertas automáticos** gerados por IA — situações que merecem sua atenção (ex: uma categoria crescendo rápido demais). Você pode dispensar cada alerta individualmente clicando no "x"; alertas dispensados não voltam a aparecer.`,

      `### Score de Saúde Financeira e Linha do Tempo
Logo abaixo dos alertas, dois cards lado a lado:
- **Score de Saúde Financeira**: uma versão resumida do score completo (veja a seção própria deste tutorial) — clique no card para ir direto à tela detalhada.
- **Linha do Tempo Financeira**: mostra os últimos lançamentos em ordem cronológica, com ícone e cor por tipo. Clique num item para ver detalhes rápidos (categoria, data de pagamento, parcela). Use o botão **"Ver todos"** para abrir a lista completa, com filtro de período e exportação para Excel.`,

      `### Distribuição de Despesas (%) e Evolução DRE Mensal
- **Distribuição de Despesas**: gráfico de pizza mostrando **onde seu dinheiro é gasto**, com cada fatia representando uma categoria de despesa (Habitação, Saúde, Automóvel, etc.). Custos e investimentos não entram nessa pizza — ela é só sobre despesas.
- **Evolução DRE Mensal**: gráfico de linhas com Receita Bruta, Despesas + Custos e Lucro Líquido mês a mês, no mesmo critério de cálculo do DRE (incluindo projeções nos meses futuros, sem duplicar quando já existe lançamento real).

**Como interpretar:** Se a linha de despesas está subindo enquanto a de receita está estável, você precisa agir. Se uma categoria ocupa mais de 30-40% da pizza de despesas, vale investigar se há espaço para redução.`,

      `### Evolução de Gastos por Categoria (Coluna Empilhada)
Gráfico de barras empilhadas, um mês ao lado do outro, mostrando a composição das despesas por categoria pai ao longo do tempo — útil para ver não só quanto você gastou, mas **em que categoria o gasto cresceu**.`,

      `### Evolução Anual por Categoria
Na parte de baixo do Dashboard, uma ferramenta de comparação ano a ano:
- **Seletor "De/até"**: escolha o intervalo de anos a comparar.
- **Seletor de visão**: "Visão Geral (Clusters)" (mostra Entradas e Saídas separadas em duas pilhas por ano, já que somar receita com despesa numa pilha só não faria sentido), "Renda Familiar", "Somente Despesas", visões específicas por categoria (Habitação, Saúde, Automóvel, Despesas Pessoais, Restaurante, Lazer, Estudos), "Investimentos", "Custos" e "Descontos".
- **Filtro de categorias**: um seletor multi-escolha permite focar em categorias específicas dentro da visão escolhida.
- A tabela mostra o total de cada ano e a variação percentual ano a ano; o gráfico logo abaixo espelha os mesmos dados em barras 3D.

**Dica do Especialista:** Consulte o Dashboard no início de cada semana para manter o controle. Use a Evolução Anual por Categoria para comparar dezembro com dezembro do ano anterior e enxergar sazonalidade (ex: gastos maiores em época de festas).`,
    ],
  },
  {
    icon: Banknote,
    title: 'Fluxo de Caixa',
    route: '/fluxo-caixa',
    description: 'Visão de liquidez — quando o dinheiro realmente entra e sai.',
    details: [
      `### Para que serve?
O **Fluxo de Caixa** mostra a movimentação **real** de dinheiro — quando ele efetivamente entra e sai da sua conta — complementando o DRE, que mede o **resultado econômico** do período (o que "pertence" a cada mês, independente de quando o pagamento acontece). Os dois números quase sempre são diferentes, e entender por quê é a parte mais importante desta tela.`,

      `### Competência (DRE) x Caixa (pagamento) — o conceito central
- **Competência**: a data que o DRE usa é a data do lançamento (ex: a data da compra). Uma compra parcelada em 12x aparece **inteira no mês da compra**.
- **Caixa**: a data que o Fluxo de Caixa usa é a **data de pagamento** de cada parcela. A mesma compra parcelada em 12x aparece **uma parcela por mês**, no mês de cada vencimento — inclusive em meses futuros.

**Exemplo prático:** Você compra uma geladeira de R$ 3.600 em 12x, em março. No DRE de março, aparece R$ 3.600 de uma vez (Investimento ou Despesa, conforme a categoria). No Fluxo de Caixa, aparecem R$ 300 em março, R$ 300 em abril, R$ 300 em maio... um por mês, até fevereiro do ano seguinte.`,

      `### Os 3 KPIs no topo
- **Entradas de Caixa**: soma de tudo que efetivamente entrou (salário, vendas, rendimentos recebidos).
- **Saídas de Caixa**: soma de tudo que efetivamente saiu (despesas, custos, impostos, aportes em investimento — que contam como saída de caixa mesmo sendo um "ganho" patrimonial —, e juros/tarifas pagos).
- **Saldo do Período**: Entradas menos Saídas. Depreciação nunca aparece aqui, porque não é dinheiro saindo do bolso.`,

      `### Gráfico "Fluxo de Caixa Mensal" e tabela de detalhamento
O gráfico mostra Entradas (verde) e Saídas (vermelho) lado a lado, mês a mês. A tabela "Detalhamento Mensal" traz, para cada mês: Entradas, Saídas, Saldo e o **Acumulado no período** — um saldo corrido somando todos os meses já mostrados na tabela (não é o saldo real da sua conta bancária, é só a soma acumulada dentro do período filtrado). Meses futuros aparecem com a etiqueta "(projetado)" e uma linha mais apagada — essa é a única marcação visual de dado projetado nesta tela.`,

      `### Card "Competência vs Caixa"
Compara lado a lado o **Lucro Líquido (DRE)** do período com a **Geração de Caixa** (Entradas − Saídas). Quando os dois divergem por mais de R$ 1, o sistema explica o motivo automaticamente:
- Se o lucro é maior que o caixa gerado: geralmente há despesas já reconhecidas no DRE mas com pagamento ainda no futuro (parcelas, provisões).
- Se o caixa gerado é maior que o lucro: geralmente há recebimentos antecipados ou ajustes de período.`,

      `### Card "Insights Financeiros"
Mostra, quando aplicável: o alerta de divergência entre lucro e caixa (mesma lógica do card anterior), um aviso se algum mês futuro do período tiver saldo de caixa negativo, o valor total em parcelas registradas no período, e uma mensagem de sucesso quando o saldo total do período é positivo.

**O que esta tela não tem:** não existe exportação (Excel/PDF) nem lupa para ver os lançamentos individuais por trás de cada número — para investigar um lançamento específico, use a lupa do DRE Detalhado.

**Dica do Especialista:** Use o Fluxo de Caixa em conjunto com o Mapa de Compromissos para antecipar meses em que o caixa pode ficar negativo por causa de parcelas acumuladas, e tome ações preventivas com antecedência.`,
    ],
  },
  {
    icon: HeartPulse,
    title: 'Score de Saúde Financeira',
    route: '/health-score',
    description: 'Nota geral da sua saúde financeira com 5 indicadores-chave.',
    details: [
      `### Para que serve?
O **Score de Saúde Financeira** calcula uma nota de 0 a 100 (20 pontos por pilar) para sua situação financeira, na seguinte ordem:
1. **Liquidez** — quantos meses de despesas suas reservas líquidas (conta corrente + dinheiro em caixa, do Balanço Patrimonial) cobririam.
2. **Controle de Gastos** — quanto da sua receita líquida é consumido por despesas, custos, impostos e despesas financeiras.
3. **Endividamento** — quanto das suas parcelas mensais de dívidas (Balanço Patrimonial) representa da sua renda.
4. **Reserva de Emergência** — quantos meses de despesas seus ativos de reserva (poupança, renda fixa, fundos) cobririam.
5. **Capacidade de Poupança** — quanto você consegue investir/guardar em relação à sua renda.

**Importante:** o cálculo sempre usa os últimos **3 meses fechados** (não considera o mês atual, ainda em andamento) — e 3 dos 5 pilares (Liquidez, Endividamento, Reserva de Emergência) dependem de você ter preenchido o Balanço Patrimonial. Sem isso, esses pilares ficam zerados mesmo que suas finanças estejam saudáveis.`,

      `### Como interpretar a nota
- **90-100**: Excelente saúde financeira.
- **75-90**: Boa saúde financeira.
- **60-75**: Saúde financeira moderada.
- **40-60**: Saúde financeira frágil.
- **0-40**: Saúde financeira crítica, priorize ações corretivas.

Na tela, você vê o placar geral, a distribuição por pilar (uma barra de progresso para cada um, de 0 a 20 pontos), uma aba de **Detalhamento dos Pilares** (com o indicador exato usado em cada um) e uma aba de **Recomendações** com um plano de ação personalizado — uma frase específica para cada pilar com nota abaixo de 10/20.`,

      `### Histórico (em desenvolvimento)
A aba "Evolução" ainda está em construção — por enquanto ela mostra um aviso de "Em breve" em vez de um gráfico de histórico. O acompanhamento mês a mês da sua nota ainda não está disponível.

**Dica do Especialista:** Foque no pilar com menor nota para obter o maior impacto. Se Liquidez ou Reserva de Emergência estiverem zeradas, comece cadastrando seus ativos no Balanço Patrimonial — isso sozinho já destrava boa parte do score.`,
    ],
  },
  {
    icon: Sparkles,
    title: 'Consultor Financeiro IA',
    route: '/inteligencia',
    description: 'Análise inteligente por IA e radar de indicadores econômicos.',
    details: [
      `### Para que serve?
Esta tela reúne duas ferramentas de inteligência artificial: o **Consultor Financeiro IA**, que analisa seus próprios dados financeiros, e o **Radar Econômico**, que traduz indicadores da economia brasileira para o impacto no seu bolso.`,

      `### Consultor Financeiro IA — como usar (passo a passo)
1. No card "Período", escolha entre **Últimos 12 meses** (padrão), **Último trimestre**, **Último semestre** ou **Personalizado** (que libera dois seletores de mês, "De" e "até"). A escolha fica salva para a próxima visita.
2. Clique em **"Gerar Análise"** (o botão passa a se chamar **"Atualizar Análise"** depois da primeira geração).
3. Aguarde o processamento — a IA analisa seus lançamentos, categorias e projeções do período.
4. O resultado aparece em 4 cards.`,

      `### As 4 seções da análise
- **Insights** (3 a 5 itens): análises sobre tendências, categorias que mais crescem, variações mensais e padrões de consumo, com números e percentuais concretos dos seus dados reais.
- **Alertas Financeiros** (até 5 itens, sem mínimo): avisos sobre situações que pedem atenção. Se não houver nada relevante, aparece "✅ Nenhum alerta identificado. Suas finanças estão em dia!".
- **Sugestões de Melhoria** (3 a 5 itens): recomendações acionáveis e específicas, baseadas nos seus números.
- **Previsão Financeira**: um resumo da tendência (positiva/negativa/estável, com um ícone), e, quando aplicável, a economia potencial estimada e detalhes extras. Se não houver dados suficientes, mostra "Dados insuficientes para previsão."

**Se você ainda não tem lançamentos nem projeções cadastradas**, a primeira análise vem com um aviso orientando a começar cadastrando seus lançamentos — não é um erro, é o comportamento esperado para conta nova.`,

      `### Histórico e possíveis erros
- O botão **"Histórico"** abre a lista das últimas 20 análises geradas, com data, período analisado e uma prévia — clique numa linha para recarregar aquela análise, ou use o ícone de lixeira para excluí-la.
- A análise mais recente é carregada automaticamente sempre que você abre a tela.
- Mensagens de erro possíveis: limite de requisições excedido, créditos de IA insuficientes, ou falha ao formatar a resposta — nesses casos, tente novamente em alguns instantes.`,

      `### Radar Econômico — para que serve
Logo abaixo do Consultor, o **Radar Econômico** (🛰️) usa IA para traduzir indicadores macroeconômicos brasileiros em impacto pessoal, cruzando com o seu comportamento financeiro dos últimos 6 meses.`,

      `### Radar Econômico — como usar e o que cada indicador significa
1. Clique em **"Gerar Radar"** (depois, **"Atualizar"**).
2. O resultado mostra, nesta ordem: um **Resumo** geral, o **Cenário Econômico Atual** (6 indicadores), o **Impacto no Seu Bolso**, **Tendências que Afetam Você** e **Recomendações Estratégicas**.

Os 6 indicadores do Cenário Econômico Atual:
- **Inflação (IPCA)**: inflação oficial do mês.
- **Taxa Selic**: taxa básica de juros.
- **CDI**: referência de rendimento de CDB e renda fixa pós-fixada — a IA compara o CDI com a inflação para mostrar seu **juro real** aproximado.
- **Combustível**: variação mensal do preço da gasolina, com base em dado oficial do IBGE (não mais uma estimativa via petróleo internacional).
- **Alimentos**: pressão inflacionária sobre alimentos, inferida a partir dos dados de inflação.
- **Dólar**: cotação PTAX do Banco Central.

Cada indicador vem com um status (ex: "alta"/"estável"/"baixa"), uma seta de tendência e um texto explicando o que aquilo significa para você.`,

      `### Radar Econômico — atualização e histórico
- Um selo **"Atualizado: dd/mm/aa às hh:mm"** mostra quando você gerou o último radar — essa é a única informação de data/hora visível na tela.
- Diferente do Consultor Financeiro IA, o Radar **não tem um histórico navegável** — só o resultado mais recente fica disponível na tela; radares antigos não podem ser reabertos.
- Possíveis erros: limite de requisições excedido, créditos de IA esgotados, ou falha temporária ao gerar — tente novamente em instantes.

**Dica do Especialista:** Gere uma análise do Consultor e um Radar Econômico no início de cada mês, depois de fechar os lançamentos do mês anterior. Como você investe em CDB, preste atenção especial ao indicador de CDI — ele mostra se o seu dinheiro parado está de fato rendendo acima da inflação.`,
    ],
  },
  {
    icon: CalendarRange,
    title: 'Mapa de Compromissos',
    route: '/compromissos',
    description: 'Visão dos seus compromissos financeiros dos próximos 12 meses.',
    details: [
      `### Para que serve?
O **Mapa de Compromissos** mostra, mês a mês, os próximos 12 meses de receitas e compromissos financeiros — parcelas em aberto, despesas fixas e tudo o mais que já está lançado ou projetado. É essencial para planejar seu fluxo de caixa e evitar surpresas.`,

      `### O que cada card de mês mostra
- **Receita, Compromissos e Sobra**: totais do mês, cobrindo todos os tipos de lançamento (não só parcelas) — a mesma classificação usada no Fluxo de Caixa.
- **Barra de progresso**: mostra visualmente o percentual da receita já comprometido no mês.
- **Parcelas**: lista das parcelas em aberto naquele mês, com número da parcela (ex: 3/12) e comentário.
- **Maiores Gastos**: as 5 categorias de despesa que mais pesam naquele mês.

Para meses futuros, se uma categoria já tem um lançamento real registrado (por exemplo, uma parcela já lançada), ele **substitui** a projeção da mesma categoria/mês em vez de somar com ela — o dado real sempre prevalece sobre a estimativa.

**Exemplo:** Você parcelou uma geladeira em 12x de R$ 300 e um celular em 10x de R$ 250. O Mapa mostra que em julho você terá pelo menos R$ 550 de compromissos fixos (parcela da geladeira + parcela do celular), somados às demais despesas do mês.`,

      `### Como usar para planejamento
1. **Identifique meses pesados**: veja quais meses têm maior volume de compromissos acumulados.
2. **Compare com a receita**: se os compromissos de um mês somam R$ 2.000 e sua receita é R$ 7.500, sobram R$ 5.500 para despesas variáveis.
3. **Evite acumular**: antes de parcelar uma nova compra, veja quanto já está comprometido nos próximos meses.
4. **Antecipe quando possível**: se identificar um mês muito apertado no futuro, considere antecipar parcelas agora.

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
O **Balanço Patrimonial** é uma "fotografia" do seu patrimônio em um dado momento. Enquanto o DRE mostra o **fluxo** mensal (quanto entra e sai), o Balanço mostra o **estoque** acumulado: tudo que você **possui** (ativos), tudo que você **deve** (passivos) e a diferença entre eles.`,

      `### Como cadastrar ativos (o que você possui)
Na aba **Ativos**, clique em **"Novo Ativo"** e preencha:
- **Nome do Ativo**: Ex: "Apartamento Centro", "CDB Banco Inter".
- **Categoria**: Conta Corrente, Poupança, Dinheiro em Caixa (agrupados na tabela como **"Ativos de Curto Prazo"**), Renda Fixa, Ações, Fundos, Criptomoedas (agrupados como **"Investimentos"**), Imóveis, Veículos, Participações, Outros Bens (agrupados como **"Bens"**).
- **Valor Atual (R$)**: valor de mercado estimado hoje.
- **Data de Aquisição** (opcional).
- **Observação** (opcional).

**Exemplo completo:** Ativo "CDB Banco Inter", categoria "Renda Fixa", valor R$ 25.000, obs "Vencimento em 2027, taxa 13% ao ano".`,

      `### Como cadastrar passivos (o que você deve)
Na aba **Passivos**, clique em **"Novo Passivo"** e preencha:
- **Nome da Dívida**: Ex: "Financiamento Apto".
- **Categoria**: Cartão de Crédito, Empréstimo (agrupados como **"Dívidas"**), Financiamento Imobiliário, Financiamento de Veículo (agrupados como **"Financiamentos"**), Parcelamento, Impostos a Pagar, Outros Passivos (agrupados como **"Outros Passivos"**).
- **Valor Total (R$)** e **Saldo Atual (R$)**: o total original da dívida e quanto ainda falta pagar hoje.
- **Parcela Mensal (R$)** e **Taxa de Juros (% a.m.)**.
- **Data de Início / Data Final** (opcional).
- **Observação** (opcional).

**Exemplo completo:** Passivo "Financiamento Apto Centro", categoria "Financiamento Imobiliário", total R$ 350.000, saldo atual R$ 280.000, parcela R$ 2.800, juros 0,75%/mês.`,

      `### Patrimônio Líquido — não é só Ativos menos Passivos
O sistema soma um terceiro componente: os **Lucros Retidos** — o Lucro Líquido acumulado de todo o histórico de lançamentos no DRE. A conta completa é:
**Patrimônio Base** (Total de Ativos − Total de Passivos) **+ Lucros Retidos (DRE) = Patrimônio Líquido**.

Essa composição aparece explicada linha a linha no card "Integração DRE → Patrimônio", junto com o Lucro do mês atual, do mês anterior e o acumulado no ano (Jan até hoje, sem contar meses futuros projetados).

O card de Patrimônio Líquido também mostra a variação percentual em relação ao mês anterior.`,

      `### Alertas automáticos
- **Patrimônio Líquido Negativo**: alerta em vermelho quando suas dívidas + o que falta de lucro acumulado superam seus bens.
- **Patrimônio em queda há 3 meses**: alerta em âmbar quando os últimos 3 snapshots mensais mostram o Patrimônio Líquido caindo de forma consecutiva.`,

      `### Gráficos
- **Lucro Líquido Mensal (DRE)**: barras de Receita/Despesas com uma linha de Lucro Líquido, últimos 12 meses.
- **Evolução Patrimonial**: área com o Patrimônio Líquido e duas linhas tracejadas de Ativos e Passivos, construída a partir de um **snapshot automático mensal** — o sistema grava (e atualiza) sozinho um registro por mês assim que os totais mudam; não existe botão para salvar manualmente nem para preencher meses passados retroativamente.`,

      `### Aba Mapa de Riqueza
Uma terceira aba com uma visão mais analítica do seu patrimônio:
- **3 indicadores**: Taxa de Crescimento (variação do patrimônio nos últimos 12 meses), Taxa de Poupança (média do que sobra ÷ média da renda) e Patrimônio/Renda (quantos anos de renda seu patrimônio representa).
- **Composição do Patrimônio**: gráfico de pizza dividindo seus ativos em Investimentos, Imóveis, Caixa, Veículos e Outros.
- **Motores de Crescimento**: gráfico de barras estimando quanto do crescimento do seu patrimônio veio de poupança, de retorno de investimentos e de valorização de bens — é uma **estimativa aproximada**, não um cálculo exato por ativo.
- **Insights Estratégicos**: frases automáticas sobre sua taxa de crescimento e de poupança no ano.

**Dica do Especialista:** Atualize os valores dos ativos e passivos pelo menos **uma vez por mês** (idealmente sempre no mesmo dia). Para investimentos, use o saldo real da corretora; para imóveis, revise o valor estimado a cada 6 meses.`,
    ],
  },
  {
    icon: Star,
    title: 'Mapa de Sonhos Financeiros',
    route: '/mapa-sonhos',
    description: 'Vincule disciplina financeira a objetivos de vida concretos.',
    details: [
      `### Para que serve?
O **Mapa de Sonhos Financeiros** permite vincular sua disciplina financeira a **objetivos de vida concretos** — comprar uma casa, fazer uma viagem, conquistar a independência financeira. O sistema acompanha o progresso, calcula o esforço mensal necessário e tenta identificar sozinho quando um sonho foi realizado.`,

      `### Como criar um sonho (passo a passo)
1. Clique em **"Novo Sonho"**.
2. Preencha:
   - **Nome do Sonho** (obrigatório): Ex: "Viagem para Europa".
   - **Categoria** (obrigatório): escolha entre as 8 categorias padrão (Casa Própria, Carro, Viagem, Cirurgia, Educação, Aposentadoria, Independência Financeira, Outro) ou clique em **"+ Nova Categoria"** para criar uma com o nome que quiser.
   - **Valor Necessário (R$)** (obrigatório).
   - **Valor Acumulado (R$)** (opcional, padrão zero).
   - **Data Desejada** (opcional, mas necessária para o cálculo de risco e de valor mensal recomendado).
   - **Descrição** (opcional).
3. Clique em **"Criar Sonho"**.`,

      `### Status dos sonhos
O status é recalculado sempre que você salva ou edita um sonho (não muda sozinho com o passar dos dias):
- **Em Progresso** (azul): situação padrão.
- **Próximo de Realizar** (verde): acumulou 75% ou mais do valor necessário.
- **Em Risco** (laranja): faltam 2 meses ou menos para a data desejada e o progresso está abaixo de 50%.
- **Concluído** (verde, com celebração animada): acumulou 100% ou mais, ou foi marcado manualmente como concluído.`,

      `### Recomendação automática de valor mensal
Para sonhos com data definida e ainda não concluídos, o sistema calcula: (Valor Necessário − Valor Acumulado) ÷ meses restantes até a data desejada.
**Exemplo**: Faltam R$ 20.000 e 10 meses → "Poupe R$ 2.000/mês para alcançar esse sonho até outubro de 2027."`,

      `### Detecção automática de conquistas
O sistema olha suas últimas 200 transações e, para cada sonho ainda não concluído, procura um lançamento cujo **valor esteja a menos de 15% do valor necessário** do sonho **e** cujo **comentário** contenha uma palavra-chave da categoria (ou uma palavra do próprio nome do sonho — ex: "europa", "viagem"). Quando encontra, mostra um banner: "Parece que você realizou o sonho: **[Nome]**", com um botão para confirmar.

**Atenção:** lançamentos sem comentário preenchido nunca são detectados — vale a pena comentar lançamentos grandes que possam corresponder a um sonho.

**Dica do Especialista:** Atualize o valor acumulado de cada sonho mensalmente. Use o resultado líquido positivo do DRE como base para decidir quanto alocar em cada sonho no mês.`,
    ],
  },
  {
    icon: Calculator,
    title: 'Simulador Financeiro',
    route: '/simulador',
    description: 'Projeção de 30 anos até a independência financeira, com dados reais.',
    details: [
      `### Para que serve?
O **Simulador Financeiro** projeta, ao longo de **30 anos fixos**, quando sua renda passiva (investimentos + rendimentos reais) passaria a cobrir suas despesas — a chamada independência financeira. Diferente do Planejador (orçamento mês a mês), ele parte de **médias reais** dos seus dados: patrimônio do Balanço Patrimonial e média de receita/despesa das suas transações — e a partir daí você ajusta hipóteses de crescimento e aporte.`,

      `### O que você ajusta em cada cenário
O valor-base de renda e despesa **não é digitado** — vem automaticamente da sua média real de transações. O que você configura é:
- **Nome do Cenário** e **Idade Atual**.
- **Retorno Anual (%)** esperado dos investimentos.
- **Patrimônio Investido Atual** e **Investimento Mensal** (aporte).
- **Crescimento da Renda (% a.a.)** e **Crescimento das Despesas (% a.a.)** — o quanto você espera que cada um cresça por ano.

Você pode manter até **4 cenários** ao mesmo tempo (botão "Novo Cenário", que já sugere uma variação otimizada/agressiva/negativa do cenário atual para comparar lado a lado) e comparar os resultados na aba "Patrimônio" do gráfico.`,

      `### Simular Evento
O botão **"Simular Evento"** permite adicionar um evento financeiro pontual ao cenário ativo: Compra de Imóvel, Compra de Veículo, Aumento de Despesas ou Aumento de Renda — financiado (informando o impacto mensal) ou à vista (informando o valor total, descontado do patrimônio de uma vez) —, e em quantos anos a partir de agora ele acontece. O evento passa a alterar a curva de projeção a partir daquele ano.`,

      `### Como o sistema usa seus dados reais
- **Patrimônio investido**: só entram no cálculo os ativos do Balanço Patrimonial dos grupos Renda Fixa, Ações, Fundos e Criptomoedas — imóveis e veículos ficam de fora, por não gerarem renda passiva direta.
- **Renda passiva real**: além do rendimento simulado sobre o patrimônio investido, o sistema soma uma renda passiva real detectada nas suas próprias transações — categorias de receita cujo nome contenha "aluguel", "rendimento", "dividendo", "juro" ou "passiv".`,

      `### O que o sistema entrega
- **Taxa de Cobertura de Despesas**: percentual da sua despesa média já coberto por renda passiva, com uma barra de progresso e o quanto falta por mês.
- **Níveis de Liberdade**: uma escada de 6 faixas, de "Início da Jornada" (0-10%) até "Independência Financeira" (100%+).
- **Metas Progressivas**: Reserva de Emergência (6x a despesa média), R$ 100 mil e R$ 500 mil de patrimônio líquido total.
- **Marcos de Cobertura**: projeção do seu patrimônio, renda passiva e taxa de cobertura daqui a 5, 10, 20 e 30 anos.
- **Gráficos**: "Cobertura" (evolução da taxa de cobertura), "Patrimônio" (compara todos os cenários criados) e "Detalhado" (patrimônio total vs. total investido no cenário ativo).
- **Insights Automáticos**: mensagens sobre seu nível atual, um alerta se suas despesas estiverem crescendo mais rápido que sua renda, e em que ano (se algum) você atingiria a independência financeira dentro dos 30 anos simulados.

**Exemplo:** Com um patrimônio investido inicial relevante e aporte mensal consistente a uma taxa de retorno realista, o simulador mostra o ano em que sua renda passiva ultrapassaria suas despesas médias.

**Dica do Especialista:** Use o Simulador em conjunto com o Consultor Financeiro IA para validar se suas premissas de crescimento são realistas frente ao seu histórico real de gastos. Crie pelo menos 2 cenários: um realista e um mais conservador.`,
    ],
  },
  {
    icon: UserCircle,
    title: 'Meu Perfil',
    route: '/perfil',
    description: 'Configurações da sua conta, dados pessoais e compartilhamento.',
    details: [
      `### Para que serve?
A tela **Meu Perfil** é onde você configura seus dados pessoais, sua foto de perfil, acompanha seu plano (Gratuito ou Premium) e gerencia o compartilhamento dos seus dados com outras pessoas (cônjuge, contador, consultor financeiro).`,

      `### Foto de Perfil e Informações Pessoais
Clique na foto circular no topo para fazer upload de uma imagem (qualquer formato de imagem é aceito) — ela aparece só nesta tela, como sua foto de perfil.

Os campos de **Informações Pessoais** são todos opcionais:
- **Nome de Exibição**.
- **Profissão**.
- **Gênero**: Masculino, Feminino, Não-binário ou Prefiro não dizer.
- **Data de Nascimento**.

Clique em **"Salvar Perfil"** para gravar as alterações.`,

      `### Logo do sistema (não fica em Meu Perfil)
O logo personalizado do aplicativo não é configurado aqui — ele fica num botão no **cabeçalho**, visível em todas as telas do sistema. Aceita qualquer arquivo de imagem, sem exigência de tamanho mínimo, e aparece apenas no cabeçalho (não é usado nos relatórios exportados em PDF/Excel).`,

      `### Compartilhamento de Acesso
Duas seções cuidam do compartilhamento:
- **Seus convites** (o que você envia): informe o e-mail da pessoa, escolha a permissão — **"Visualizar"** (só consulta os relatórios e lançamentos) ou **"Editar"** (também pode lançar e alterar dados) — e clique em **"Convidar"**. O convite fica "Pendente" até a pessoa aceitar, e você pode **revogar** a qualquer momento pelo ícone de lixeira.
- **Acessos Recebidos** (convites que outras pessoas te enviaram): aparecem aqui para você aprovar (✓) ou rejeitar (✗).

**Dica do Especialista:** Se você usa um contador, compartilhe com permissão **"Visualizar"**. Assim ele pode consultar relatórios sem risco de alterar seus dados acidentalmente.`,
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
            {['Como funciona o parcelamento?', 'O que é o EBITDA?', 'Como compartilhar meus dados?', 'Como mover uma subcategoria?', 'Como importar um extrato bancário?'].map((q) => (
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
