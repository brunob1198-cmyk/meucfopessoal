

# DRE Pessoal - App de Finanças Pessoais Avançado

## Visão Geral
App de finanças pessoais baseado em DRE empresarial, com interface em português, armazenamento na nuvem (Supabase) e foco em lançamentos ultra-rápidos.

---

## 1. Autenticação e Banco de Dados
- Login/cadastro com email e senha
- Tabelas: `profiles`, `categories` (hierárquicas com parent_id), `transactions` (com suporte a parcelamento), `projections`
- Categorias pré-cadastradas conforme a estrutura DRE fornecida (Receita Bruta, Descontos, Custos, Despesas com todas as subcategorias)
- RLS para isolamento de dados por usuário

## 2. Navegação Principal
- Sidebar com 5 módulos: **Lançamentos**, **DRE Detalhado**, **DRE Ajustado**, **Planejador**, **Dashboard**
- Design minimalista, fundo claro, inspirado em dashboards financeiros/ERP

## 3. Tela de Lançamentos (Prioridade Máxima)
- Lista todas as categorias e subcategorias em formato expansível (accordion)
- Clique na subcategoria → mini formulário inline com: valor, data, comentário opcional
- Toggle para "parcelado" → campos adicionais: nº parcelas, valor parcela, data inicial
- Sistema gera automaticamente os lançamentos futuros para parcelas
- Meta: registrar gasto em menos de 3 segundos

## 4. DRE Detalhado
- Estrutura completa: Receita Bruta → Descontos → Receita Líquida → Custos → Lucro Bruto → Despesas → EBITDA → EBIT → LAIR → Lucro Líquido
- Valores em R$ e percentuais
- Filtro por mês/período
- Atualização automática conforme lançamentos

## 5. DRE Ajustado (Resumido)
- Versão simplificada do DRE com as mesmas métricas principais
- Visão rápida e limpa para análise estratégica

## 6. Planejador / Projeções
- Formulário para definir receitas e despesas projetadas por categoria
- Geração de DRE projetado
- Comparativo visual: Real vs Projetado em tabela lado a lado

## 7. Dashboard Financeiro
- Gráfico de pizza/donut: distribuição de gastos por categoria
- Gráfico de linhas/barras: evolução mensal por categoria
- Filtros: mês, trimestre, ano, período personalizado
- Cards de resumo: Receita Líquida, EBITDA, Lucro Líquido

## 8. Funcionalidades Extras
- Gerenciamento de categorias: criar, editar, excluir categorias e subcategorias
- Busca de lançamentos por texto/categoria/período
- Exportação para CSV e Excel

