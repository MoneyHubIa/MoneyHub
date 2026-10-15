# Plano de Implementação: Paginação em Transações, Modais em Contas a Pagar/Receber e Tema Escuro

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar paginação e filtros em Transações, migrar cadastros de Contas a Pagar e Receber para modais flutuantes (`ThemedModal`), e corrigir bugs de tema escuro em Recorrências, Centros de Custo e Agenda.

**Architecture:** 
- `Transactions`: paginação baseada em estado (`page`, `pageSize = 10`), cálculo derivado de fatiamento (`paginatedTransactions = filteredTransactions.slice(...)`), botões de navegação e filtros rápidos por tipo e categoria.
- `AccountsPayable` & `AccountsReceivable`: cabeçalho limpo com KPI cards de status, botão de ação primária `+ Nova Conta`, e modal flutuante com `ThemedModal` reutilizado para criação e edição com `DatePickerInput`.
- `RecurringTransactions`, `CostCenters`, `Agenda`: injeção de `useTheme()`, substituição de cores fixas `#ffffff`/`#f8fafc` por `tokens.bgSurface`, `tokens.bgElevated`, `tokens.borderElevated`, `tokens.textPrimary`, `tokens.textSecondary`.

**Tech Stack:** React 19, React Native (Web), Apollo Client (GraphQL), Lucide React Native, Jest / React Native Testing Library, TypeScript estrito (zero `any`).

## Global Constraints
- NUNCA utilizar `any` ou `as any` em TypeScript.
- Respeitar `exactOptionalPropertyTypes: true` em interfaces e componentes.
- Todos os testes de Jest existentes e novos devem passar (`npm test`).
- Comandos devem usar `npx.cmd` no ambiente Windows PowerShell.

---

### Task 1: Paginação e Filtros em Transações
**Files:**
- Modify: `apps/frontend/src/components/Transactions.tsx`
- Modify: `apps/frontend/tests/Transactions.test.tsx`

- [ ] **Step 1: Atualizar testes em Transactions.test.tsx para testar paginação de 10 itens e navegação**
- [ ] **Step 2: Rodar teste para verificar falha antes da implementação**
- [ ] **Step 3: Implementar paginação (10 itens/página), controle Anterior/Próxima e filtro por categoria em Transactions.tsx**
- [ ] **Step 4: Rodar teste para verificar aprovação**

---

### Task 2: Modal Flutuante em Contas a Pagar
**Files:**
- Modify: `apps/frontend/src/components/AccountsPayable.tsx`
- Modify: `apps/frontend/tests/AccountsPayable.test.tsx`

- [ ] **Step 1: Atualizar testes em AccountsPayable.test.tsx para validar abertura do modal via botão "Nova Conta a Pagar" e via botão de edição**
- [ ] **Step 2: Rodar teste para verificar falha**
- [ ] **Step 3: Refatorar AccountsPayable.tsx removendo o formulário estático do topo e integrando ThemedModal**
- [ ] **Step 4: Rodar teste para verificar aprovação**

---

### Task 3: Modal Flutuante em Contas a Receber
**Files:**
- Modify: `apps/frontend/src/components/AccountsReceivable.tsx`
- Modify: `apps/frontend/tests/AccountsReceivable.test.tsx`

- [ ] **Step 1: Atualizar testes em AccountsReceivable.test.tsx para validar abertura do modal via botão "Nova Conta a Receber" e via botão de edição**
- [ ] **Step 2: Rodar teste para verificar falha**
- [ ] **Step 3: Refatorar AccountsReceivable.tsx removendo o formulário estático do topo e integrando ThemedModal**
- [ ] **Step 4: Rodar teste para verificar aprovação**

---

### Task 4: Correção de Tema Escuro em Recorrências
**Files:**
- Modify: `apps/frontend/src/components/RecurringTransactions.tsx`
- Test: `apps/frontend/tests/RecurringTransactions.test.tsx`

- [ ] **Step 1: Integrar useTheme() e substituir fundos brancos por tokens de tema escuro em RecurringTransactions.tsx**
- [ ] **Step 2: Rodar teste RecurringTransactions.test.tsx para verificar aprovação**

---

### Task 5: Correção de Tema Escuro em Centros de Custo
**Files:**
- Modify: `apps/frontend/src/components/CostCenters.tsx`
- Test: `apps/frontend/tests/CostCenters.test.tsx`

- [ ] **Step 1: Integrar useTheme() e substituir fundos brancos por tokens de tema escuro em CostCenters.tsx**
- [ ] **Step 2: Rodar teste CostCenters.test.tsx para verificar aprovação**

---

### Task 6: Correção de Tema Escuro em Agenda
**Files:**
- Modify: `apps/frontend/src/components/Agenda.tsx`
- Test: `apps/frontend/tests/Agenda.test.tsx`

- [ ] **Step 1: Integrar useTheme() e substituir fundos brancos por tokens de tema escuro em Agenda.tsx**
- [ ] **Step 2: Rodar teste Agenda.test.tsx para verificar aprovação**

---

### Task 7: Verificação Completa e Auditoria TypeScript
**Files:**
- Run: `npx.cmd tsc --noEmit`
- Run: Grep check for `any`
- Run: `npx.cmd jest --runInBand`

- [ ] **Step 1: Executar checagem de tipos tsc**
- [ ] **Step 2: Auditar ausência de any**
- [ ] **Step 3: Executar a suíte completa de testes do frontend**
