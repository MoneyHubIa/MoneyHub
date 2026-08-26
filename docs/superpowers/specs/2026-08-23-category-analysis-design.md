# Especificação de Design: TASK-029 — Análise por Categoria

## Objetivo
Disponibilizar uma análise e distribuição financeira detalhada por categorias, permitindo aos usuários identificar seus principais direcionadores de gastos e fontes de receita no mês selecionado.

---

## 1. Arquitetura do Backend (GraphQL e Agregação)

### 1.1 Definição do Schema
- **Enums**:
  - `CategoryAnalysisType`: `EXPENSE` | `INCOME`
- **Inputs**:
  - `CategoryAnalysisInput`:
    - `type`: `CategoryAnalysisType` (opcional, padrão: `EXPENSE`)
    - `month`: `Int` (opcional, padrão: mês UTC atual, 1-12)
    - `year`: `Int` (opcional, padrão: ano UTC atual, 2000-2100)
- **Tipos**:
  - `CategoryAnalysisItem`:
    - `categoryId`: `ID!`
    - `categoryName`: `String!`
    - `categoryColor`: `String!`
    - `categoryIcon`: `String!`
    - `totalAmount`: `String!` (valor monetário formatado com 2 casas decimais)
    - `percentage`: `Float!` (porcentagem de 0.0 a 100.0 em relação ao total, ex: 35.5)
    - `transactionCount`: `Int!`
  - `CategoryAnalysisResult`:
    - `type`: `CategoryAnalysisType!`
    - `month`: `Int!`
    - `year`: `Int!`
    - `totalAmount`: `String!`
    - `items`: `[CategoryAnalysisItem!]!`
- **Query**:
  - `categoryAnalysis(input: CategoryAnalysisInput): CategoryAnalysisResult!`

### 1.2 Lógica de Agregação
- Escopo estrito ao usuário autenticado (`userId` do contexto).
- Filtra lançamentos ativos (`deletedAt: null`) em `Income` ou `Expense` dentro do intervalo do mês.
- Agrupa por `categoryId`, somando os valores e contando os lançamentos.
- Busca os metadados da categoria (`name`, `color`, `icon`) em `FinancialCategory`.
- Calcula a porcentagem de cada categoria: `(totalCategoria / totalGeral) * 100`.
- Ordena a lista em ordem decrescente pelo `totalAmount`.
- Trata cenários como meses sem movimentações ou categorias deletadas (fallback para "Sem categoria").

---

## 2. Arquitetura do Frontend (Expo / React Native Web)

### 2.1 Componente: `CategoryAnalysis`
- **Localização**: `apps/frontend/src/components/CategoryAnalysis.tsx`
- **Funcionalidades e Estilo**:
  - **Alternador de Tipo**: Botões em formato de pílula para alternar entre `💸 Despesas` e `💰 Receitas`.
  - **Barra de Distribuição Proporcional**: Barra horizontal segmentada no topo, destacando visualmente o peso de cada categoria pelas suas respectivas cores.
  - **Lista de Ranking**:
    - Cards ordenados pelo valor (Ranking #1, #2, ...).
    - Ícone e badge com a cor da categoria.
    - Nome da categoria e contagem de transações.
    - Valor formatado na moeda do perfil e tag com a porcentagem correspondente.
  - **Estado Vazio**: Mensagem amigável com orientações caso não existam lançamentos no mês.

### 2.2 Integração no Dashboard
- Integra o componente `CategoryAnalysis` diretamente em `DashboardShell.tsx` em harmonia com o gráfico de fluxo de caixa.

---

## 3. Plano de Testes e Validação
- **Backend (`apps/backend/tests/category-analysis.test.ts`)**:
  - Agregação de despesas por categoria com cálculo de porcentagem e ordenação decrescente.
  - Agregação de receitas por categoria.
  - Verificação de mês vazio.
  - Validação de autenticação e e-mail verificado.
  - Validação de parâmetros inválidos (mês ou ano fora do range).
- **Frontend (`apps/frontend/tests/CategoryAnalysis.test.tsx`)**:
  - Renderização dos itens do ranking e da barra de proporção.
  - Alternância entre Despesas e Receitas.
  - Formatação correta de moedas e porcentagens.
