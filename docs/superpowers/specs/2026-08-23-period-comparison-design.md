# Especificação de Design: TASK-030 — Comparativo de Períodos

## Objetivo
Permitir a comparação flexível de métricas financeiras entre dois períodos selecionados livremente pelo usuário (ex: Mês Atual vs Mês Anterior, Mês Atual vs Mesmo Mês do Ano Anterior, ou quaisquer dois meses escolhidos), destacando a evolução de receitas, despesas, saldo líquido e taxa de economia.

---

## 1. Arquitetura do Backend (GraphQL e Agregação)

### 1.1 Definição do Schema
- **Inputs**:
  - `PeriodComparisonInput`:
    - `baseMonth`: `Int` (opcional, padrão: mês atual)
    - `baseYear`: `Int` (opcional, padrão: ano atual)
    - `comparisonMonth`: `Int` (opcional, padrão: mês anterior)
    - `comparisonYear`: `Int` (opcional, padrão: ano do mês anterior)
- **Tipos**:
  - `PeriodMetrics`:
    - `month`: `Int!`
    - `year`: `Int!`
    - `label`: `String!` (ex: `"Agosto/2026"`)
    - `totalIncome`: `String!`
    - `totalExpense`: `String!`
    - `netBalance`: `String!`
    - `savingsRate`: `Float!` (taxa de economia: `(netBalance / totalIncome) * 100`, de 0 a 100% ou 0 se income <= 0)
    - `incomeCount`: `Int!`
    - `expenseCount`: `Int!`
  - `PeriodComparisonDelta`:
    - `incomeDelta`: `String!` (diferença monetária)
    - `incomePercentage`: `Float!` (variação percentual, ex: +15.5%)
    - `expenseDelta`: `String!`
    - `expensePercentage`: `Float!`
    - `netBalanceDelta`: `String!`
    - `netBalancePercentage`: `Float!`
    - `savingsRateDelta`: `Float!` (diferença em pontos percentuais da taxa de economia)
  - `PeriodComparisonResult`:
    - `basePeriod`: `PeriodMetrics!`
    - `comparisonPeriod`: `PeriodMetrics!`
    - `delta`: `PeriodComparisonDelta!`
- **Query**:
  - `periodComparison(input: PeriodComparisonInput): PeriodComparisonResult!`

### 1.2 Lógica de Agregação
- Validação de usuário autenticado e e-mail verificado (`requireVerifiedUserId`).
- Agregação paralela das métricas do Período Base e do Período Comparativo via Prisma (filtrando `deletedAt: null` e `userId`).
- Cálculo seguro de variações percentuais (evitando divisões por zero com fallback para 0.0% ou +100% quando o período de referência for zero).
- Tipagem TypeScript estrita sem nenhum `any`.

---

## 2. Arquitetura do Frontend (Expo / React Native Web)

### 2.1 Componente: `PeriodComparison`
- **Localização**: `apps/frontend/src/components/PeriodComparison.tsx`
- **Controles e Layout**:
  - **Seleção de Períodos**: Controles para ajustar livremente o Período Base e o Período Comparativo, com botões de atalho rápido (*"Mês Anterior"*, *"Ano Anterior (YoY)"*).
  - **Cards Comparativos**:
    - **Receitas (Entradas)**: Exibe valor base, valor comparado e badge com variação percentual (Verde para crescimento, Vermelho para queda).
    - **Despesas (Saídas)**: Exibe valor base, valor comparado e badge inteligente (Verde para redução de despesas, Vermelho para aumento de gastos).
    - **Saldo Líquido**: Exibe o saldo dos dois períodos e a diferença monetária e percentual.
    - **Taxa de Economia**: Percentual da renda poupado em cada período com variação em pontos percentuais.
  - **Design System**: Estética alinhada ao MoneyHub, com sombras suaves, dark mode tokens e compatibilidade 100% web/mobile.

### 2.2 Integração no Dashboard
- Integrado em `DashboardShell.tsx`, completando a suíte de indicadores do **EPIC-04**.

---

## 3. Plano de Testes e Validação
- **Backend Tests (`apps/backend/tests/period-comparison.test.ts`)**:
  - Comparativo entre dois meses com variação positiva, negativa e nula.
  - Cálculo de taxa de economia e deltas percentuais.
  - Tratamento de meses sem movimentação (divisão por zero segura).
  - Validação de autenticação e inputs inválidos.
- **Frontend Tests (`apps/frontend/tests/PeriodComparison.test.tsx`)**:
  - Renderização dos cards comparativos, badges de variação e atalhos de seleção.
  - Formatação de moedas e porcentagens.
