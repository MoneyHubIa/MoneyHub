# Especificação de Design: TASK-013 — AI Context Builder

## Objetivo
Construir o serviço backend de montagem de contexto financeiro seguro (`AI Context Builder`) para o assistente de IA do MoneyHub (EPIC-05). O serviço agrega de forma isolada por usuário (`userId`) as métricas e indicadores financeiros de um período, gerando um payload sintetizado e estritamente tipado, exposto internamente e via query GraphQL.

---

## 1. Arquitetura do Backend

### 1.1 Schema GraphQL
- **Tipos**:
  - `AiFinancialTotals`:
    - `income`: `String!` (valor monetário formatado, ex: `"4500.00"`)
    - `expenses`: `String!` (ex: `"2300.00"`)
    - `balance`: `String!` (ex: `"2200.00"`)
  - `AiTopCategory`:
    - `categoryName`: `String!`
    - `amount`: `String!`
    - `percentage`: `Float!` (0.0 a 100.0)
    - `color`: `String`
    - `icon`: `String`
  - `AiUpcomingBill`:
    - `id`: `ID!`
    - `description`: `String!`
    - `amount`: `String!`
    - `dueDate`: `String!` (formato ISO/Date)
    - `categoryName`: `String`
  - `AiFinancialContext`:
    - `version`: `String!` (ex: `"1.0"`)
    - `period`: `String!` (ex: `"2026-08"`)
    - `currency`: `String!` (ex: `"BRL"`)
    - `generatedAt`: `String!` (ISO timestamp UTC)
    - `totals`: `AiFinancialTotals!`
    - `topExpenseCategories`: `[AiTopCategory!]!`
    - `upcomingBills`: `[AiUpcomingBill!]!`
    - `goals`: `[String!]!` (vazio inicialmente)
- **Input**:
  - `AiFinancialContextInput`:
    - `month`: `Int` (1 a 12, opcional, padrão: mês atual UTC)
    - `year`: `Int` (2000 a 2100, opcional, padrão: ano atual UTC)
    - `billsDaysAhead`: `Int` (1 a 90, opcional, padrão: 30 dias)
- **Query**:
  - `aiFinancialContext(input: AiFinancialContextInput): AiFinancialContext!`

### 1.2 Serviço e Repositório (`ai-context-builder.ts`)
- **Isolamento de Segurança**:
  - Exige usuário autenticado e e-mail verificado através de `requireVerifiedUserId(context)`.
  - Todas as consultas ao banco são estritamente filtradas por `userId` e `deletedAt: null`.
  - Nunca expõe dados sensíveis, credenciais de banco ou dados de outros usuários.
- **Interface do Repositório (`AiContextRepository`)**:
  - `getUserCurrency(userId: string): Promise<string>`
  - `getTotals(userId: string, startDate: Date, endDate: Date): Promise<{ income: number; expenses: number }>`
  - `getTopExpenseCategories(userId: string, startDate: Date, endDate: Date, limit: number): Promise<Array<{ categoryName: string; amount: number; color?: string; icon?: string }>>`
  - `getUpcomingBills(userId: string, fromDate: Date, toDate: Date, limit: number): Promise<Array<{ id: string; description: string; amount: number; dueDate: Date; categoryName?: string }>>`
- **TypeScript Forte**:
  - Proibição absoluta de `any` conforme diretriz global do projeto.
  - Tipos e interfaces explícitos para todas as estruturas de dados.

---

## 2. Estratégia de Testes

### 2.1 Testes Unitários (`apps/backend/tests/ai-context-builder.test.ts`)
- Agregação e formatação precisa de receitas, despesas e saldo líquido.
- Agrupamento e cálculo de porcentagem no Top Categorias de Despesas.
- Filtragem e ordenação cronológica das contas a pagar pendentes (`upcomingBills`).
- Tratamento de meses sem movimentação (totais 0.00, listas vazias, sem erro de divisão por zero).
- Fallback seguro para moeda padrão (`BRL`) quando o perfil do usuário não tiver moeda configurada.
- Validação e rejeição de entradas inválidas (`BAD_USER_INPUT` para meses fora de 1-12, anos fora de 2000-2100).
- Rejeição de requisições não autenticadas ou com e-mail não verificado (`UNAUTHENTICATED`, `FORBIDDEN`).

### 2.2 Testes de Integração GraphQL (`apps/backend/tests/graphql.test.ts`)
- Execução da query `aiFinancialContext` via Apollo Server context, assegurando a resolução e serialização corretas dos dados.
