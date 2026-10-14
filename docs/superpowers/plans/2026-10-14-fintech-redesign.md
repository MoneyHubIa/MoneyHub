# Plano de Implementação: Redesign Fintech do MoneyHub

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar a camada visual e de navegação do MoneyHub para aplicar um Design System de Fintech moderno com Dark Mode (padrão) e Light Mode, adaptando-se automaticamente para Web (Desktop com Sidebar) e Android (Mobile com Quick Pills e Bottom Navigation Bar com botão central flutuante), preservando 100% da lógica e dos dados existentes.

**Architecture:** Abordagem modular unificada com Tokens de design centralizados, `ThemeContext` tipado persistido em `AsyncStorage` + sincronização no perfil, UI primitives acessíveis e Shell responsivo chaveado por `useResponsive()` (`width >= 1024`).

**Tech Stack:** React 19, React Native 0.86, Expo 57, React Native Web 0.21, Apollo Client 4, Lucide React Native, AsyncStorage.

## Global Constraints

- Proibição estrita de `any` em variáveis, parâmetros, retornos, interfaces e componentes. Usar `unknown`, unions ou tipos explícitos.
- Dark Mode padrão: `bgPrimary: '#0B0F19'`, `bgSurface: '#111827'`, `bgElevated: '#1E293B'`, `border: '#1E293B'`, `borderElevated: '#334155'`, `textPrimary: '#F8FAFC'`, `textSecondary: '#94A3B8'`, `textMuted: '#64748B'`.
- Light Mode: `bgPrimary: '#F8FAFC'`, `bgSurface: '#FFFFFF'`, `bgElevated: '#F1F5F9'`, `border: '#E2E8F0'`, `borderElevated: '#CBD5E1'`, `textPrimary: '#0F172A'`, `textSecondary: '#64748B'`, `textMuted: '#94A3B8'`.
- Cores Semânticas Fixas: Receitas `#10B981` (badge `rgba(16, 185, 129, 0.15)`), Despesas `#F43F5E` (badge `rgba(244, 63, 94, 0.15)`), Alertas `#F59E0B`, IA `#6366F1`, Info `#06B6D4`.
- Breakpoint desktop: `width >= 1024`.
- Área de toque mínima em botões interativos: 44x44px.
- Todos os testes Jest do repositório devem passar ao final de cada tarefa (`npm test`).

---

### Task 1: Tokens Visuais, ThemeContext & Hook `useResponsive`

**Files:**
- Create: `apps/frontend/src/theme/tokens.ts`
- Create: `apps/frontend/src/theme/ThemeContext.tsx`
- Create: `apps/frontend/src/theme/useResponsive.ts`
- Modify: `apps/frontend/app/_layout.tsx`
- Test: `apps/frontend/tests/ThemeContext.test.tsx`
- Test: `apps/frontend/tests/useResponsive.test.ts`

**Interfaces:**
- Produces:
  - `ColorTokens`, `ThemeMode ('dark' | 'light')`, `tokens: Record<ThemeMode, ColorTokens>`
  - `useTheme(): { theme: ColorTokens; isDark: boolean; mode: ThemeMode; toggleTheme: () => void; setThemeMode: (mode: ThemeMode) => void }`
  - `useResponsive(): { isDesktop: boolean; isMobile: boolean; width: number; height: number }`

- [ ] **Step 1: Escrever testes unitários para `tokens`, `ThemeContext` e `useResponsive`**
Criar `apps/frontend/tests/ThemeContext.test.tsx` validando fallback para dark mode, alternância para light mode, persistência via `AsyncStorage` e dispatch para perfil. Criar `apps/frontend/tests/useResponsive.test.ts` testando breakpoint `>= 1024`.

- [ ] **Step 2: Rodar testes e verificar falha**
Executar: `npm test -- tests/ThemeContext.test.tsx tests/useResponsive.test.ts`
Esperado: FAIL (módulos ainda não existem).

- [ ] **Step 3: Implementar `tokens.ts`, `ThemeContext.tsx` e `useResponsive.ts`**
Criar `tokens.ts` com as paletas Dark e Light exatas e cores semânticas. Criar `ThemeContext.tsx` com `ThemeProvider` usando `AsyncStorage.getItem('@moneyhub:theme_mode')` com fallback `'dark'` e sincronização com `useMutation(UPDATE_MY_PROFILE)`. Criar `useResponsive.ts` com `useWindowDimensions()`.

- [ ] **Step 4: Atualizar `app/_layout.tsx`**
Envolver a árvore de componentes no `ThemeProvider` e ajustar `StatusBar style={isDark ? 'light' : 'dark'}`.

- [ ] **Step 5: Rodar testes e verificar aprovação**
Executar: `npm test -- tests/ThemeContext.test.tsx tests/useResponsive.test.ts`
Esperado: PASS.

- [ ] **Step 6: Commit**
`git add apps/frontend/src/theme apps/frontend/app/_layout.tsx apps/frontend/tests/ThemeContext.test.tsx apps/frontend/tests/useResponsive.test.ts`
`git commit -m "feat(theme): add tokens, ThemeContext, useResponsive and root layout integration"`

---

### Task 2: UI Primitives (`Card`, `KpiCard`, `Badge`, `Button`, `ThemedModal`, `Input`, `ProgressBar`)

**Files:**
- Create: `apps/frontend/src/components/ui/Card.tsx`
- Create: `apps/frontend/src/components/ui/KpiCard.tsx`
- Create: `apps/frontend/src/components/ui/Badge.tsx`
- Create: `apps/frontend/src/components/ui/Button.tsx`
- Create: `apps/frontend/src/components/ui/ThemedModal.tsx`
- Create: `apps/frontend/src/components/ui/Input.tsx`
- Create: `apps/frontend/src/components/ui/ProgressBar.tsx`
- Test: `apps/frontend/tests/UiPrimitives.test.tsx`

**Interfaces:**
- Consumes: `useTheme` de `src/theme/ThemeContext.tsx`.
- Produces:
  - `<Card variant="surface" | "elevated" | "gradient" ... />`
  - `<KpiCard title="..." value="..." icon={...} tone="neutral" | "income" | "expense" | "warning" ... />`
  - `<Badge label="..." tone="income" | "expense" | "warning" | "brandAI" | "neutral" ... />`
  - `<Button title="..." onPress={...} variant="primary" | "secondary" | "danger" | "ghost" loading={...} />`
  - `<ThemedModal visible={...} onClose={...} title="...">`
  - `<Input label="..." value={...} onChangeText={...} error={...} />`
  - `<ProgressBar progress={0.65} color="#10B981" />`

- [ ] **Step 1: Escrever teste de renderização e acessibilidade para os UI Primitives**
Criar `apps/frontend/tests/UiPrimitives.test.tsx` validando renderização nos modos Dark e Light, disparo de eventos em botões e exibição acessível de labels.

- [ ] **Step 2: Rodar teste e verificar falha**
Executar: `npm test -- tests/UiPrimitives.test.tsx`
Esperado: FAIL.

- [ ] **Step 3: Implementar os componentes UI Primitives em `src/components/ui/`**
Garantir altura mínima de 44px para cliques, suporte a ícones Lucide, tipagem estrita sem `any`.

- [ ] **Step 4: Rodar teste e verificar aprovação**
Executar: `npm test -- tests/UiPrimitives.test.tsx`
Esperado: PASS.

- [ ] **Step 5: Commit**
`git add apps/frontend/src/components/ui apps/frontend/tests/UiPrimitives.test.tsx`
`git commit -m "feat(ui): add accessible fintech UI primitives"`

---

### Task 3: Layouts Responsivos (Sidebar, AppHeader, QuickPills, BottomNavBar, QuickActionModal)

**Files:**
- Create: `apps/frontend/src/components/layout/AppHeader.tsx`
- Create: `apps/frontend/src/components/layout/Sidebar.tsx`
- Create: `apps/frontend/src/components/layout/QuickPills.tsx`
- Create: `apps/frontend/src/components/layout/BottomNavBar.tsx`
- Create: `apps/frontend/src/components/layout/QuickActionModal.tsx`
- Test: `apps/frontend/tests/LayoutComponents.test.tsx`

**Interfaces:**
- Consumes: `useTheme`, `useResponsive`, `NotificationCenter`.
- Produces:
  - `<Sidebar activeSection={...} onSelectSection={...} pendingPayablesCount={...} pendingReceivablesCount={...} onQuickAction={...} onLogout={...} />`
  - `<AppHeader title={...} onToggleTheme={...} onSelectCurrency={...} />`
  - `<QuickPills activeSection={...} onSelectSection={...} />`
  - `<BottomNavBar activeSection={...} onSelectSection={...} onOpenNewModal={...} />`

- [ ] **Step 1: Escrever testes unitários para a navegação adaptativa**
Criar `apps/frontend/tests/LayoutComponents.test.tsx` simulando resoluções Desktop (1024px) e Mobile (390px), testando clique nas abas, acionamento do botão central `+` e alternador de tema.

- [ ] **Step 2: Rodar teste e verificar falha**
Executar: `npm test -- tests/LayoutComponents.test.tsx`
Esperado: FAIL.

- [ ] **Step 3: Implementar componentes de layout**
Criar `Sidebar.tsx` com 7 módulos + secundários + ações rápidas. Criar `QuickPills.tsx` deslizável horizontalmente. Criar `BottomNavBar.tsx` com 5 botões e botão central flutuante `#10B981`. Criar `AppHeader.tsx` com alternador Dark/Light e moeda.

- [ ] **Step 4: Rodar teste e verificar aprovação**
Executar: `npm test -- tests/LayoutComponents.test.tsx`
Esperado: PASS.

- [ ] **Step 5: Commit**
`git add apps/frontend/src/components/layout apps/frontend/tests/LayoutComponents.test.tsx`
`git commit -m "feat(layout): add adaptive sidebar, app header, quick pills and bottom nav bar"`

---

### Task 4: Categorias Financeiras (Tela Exclusiva, Abas de Tipo, Seletor de 9 Cores e Ícone)

**Files:**
- Modify: `apps/frontend/src/components/FinancialCategories.tsx`
- Test: `apps/frontend/tests/FinancialCategories.test.tsx`

**Interfaces:**
- Consumes: `MY_CATEGORIES_QUERY`, `CREATE_CATEGORY_MUTATION`, `UPDATE_CATEGORY_MUTATION`, `DELETE_CATEGORY_MUTATION`, UI Primitives (`Card`, `ThemedModal`, `Button`, `Input`).
- Produces: Tela de Categorias segregada com filtros (`Todas`, `Despesas`, `Receitas`), cards com cor e ícone, modal de cadastro com paleta de 9 cores (`#10B981`, `#06B6D4`, `#3B82F6`, `#6366F1`, `#8B5CF6`, `#EC4899`, `#F43F5E`, `#F59E0B`, `#84CC16`) e seletor de ícones.

- [ ] **Step 1: Atualizar testes de `FinancialCategories.test.tsx`**
Ajustar os testes para cobrir os novos modais, seleção de abas de filtro e escolha de cor na paleta.

- [ ] **Step 2: Rodar testes e verificar falhas esperadas**
Executar: `npm test -- tests/FinancialCategories.test.tsx`

- [ ] **Step 3: Refatorar `FinancialCategories.tsx`**
Implementar abas de filtro (`ALL`, `EXPENSE`, `INCOME`), cards estilizados com badge de tipo e total gasto, modal com paleta de 9 cores e catálogo visual de ícones Lucide.

- [ ] **Step 4: Rodar testes e verificar aprovação**
Executar: `npm test -- tests/FinancialCategories.test.tsx`
Esperado: PASS.

- [ ] **Step 5: Commit**
`git add apps/frontend/src/components/FinancialCategories.tsx apps/frontend/tests/FinancialCategories.test.tsx`
`git commit -m "feat(categories): refactor financial categories with 9-color palette, icon picker and type tabs"`

---

### Task 5: Contas a Pagar e Contas a Receber (3 KPIs, 1-Click Pay/Receive, Badges)

**Files:**
- Modify: `apps/frontend/src/components/AccountsPayable.tsx`
- Modify: `apps/frontend/src/components/AccountsReceivable.tsx`
- Test: `apps/frontend/tests/AccountsPayable.test.tsx`
- Test: `apps/frontend/tests/AccountsReceivable.test.tsx`

**Interfaces:**
- Consumes: GraphQL queries/mutations de payables e receivables, UI Primitives, `useTheme`.
- Produces: Telas com 3 KPIs superiores, listas com badges de status e botão de ação rápida ("Pagar" / "Receber" em 1 clique) e modais para novos lançamentos.

- [ ] **Step 1: Atualizar testes de `AccountsPayable.test.tsx` e `AccountsReceivable.test.tsx`**
Garantir que a baixa em 1 clique continua funcionando perfeitamente e os 3 KPIs são calculados corretamente.

- [ ] **Step 2: Rodar testes para verificar pontos de quebra visual**
Executar: `npm test -- tests/AccountsPayable.test.tsx tests/AccountsReceivable.test.tsx`

- [ ] **Step 3: Refatorar `AccountsPayable.tsx` e `AccountsReceivable.tsx`**
Inserir os 3 KPIs superiores (Total Pendente, Vencendo Hoje / Atrasadas, Total Pago/Recebido). Aplicar cards `bgSurface`, badge `Recorrente`, indicador `Alerta X dias antes` e botão em destaque para baixa.

- [ ] **Step 4: Rodar testes e verificar aprovação**
Executar: `npm test -- tests/AccountsPayable.test.tsx tests/AccountsReceivable.test.tsx`
Esperado: PASS.

- [ ] **Step 5: Commit**
`git add apps/frontend/src/components/AccountsPayable.tsx apps/frontend/src/components/AccountsReceivable.tsx apps/frontend/tests/AccountsPayable.test.tsx apps/frontend/tests/AccountsReceivable.test.tsx`
`git commit -m "feat(accounts): modernize accounts payable and receivable with 3 KPIs and 1-click actions"`

---

### Task 6: Transações & Metas Financeiras (Preview Estilizado)

**Files:**
- Modify: `apps/frontend/src/components/Transactions.tsx`
- Create: `apps/frontend/src/components/FinancialGoalsPreview.tsx`
- Test: `apps/frontend/tests/Transactions.test.tsx`
- Test: `apps/frontend/tests/FinancialGoalsPreview.test.tsx`

**Interfaces:**
- Consumes: `useTheme`, `formatCurrency`, UI Primitives.
- Produces:
  - `Transactions`: extrato completo estilizado com filtros rápidos e valores coloridos (`#10B981` / `#F43F5E`).
  - `FinancialGoalsPreview`: tela de Metas totalmente segregada demonstrando objetivos com barras de progresso fintech e selo de módulo em preparação.

- [ ] **Step 1: Escrever testes para `FinancialGoalsPreview` e atualizar `Transactions.test.tsx`**
Criar `apps/frontend/tests/FinancialGoalsPreview.test.tsx`.

- [ ] **Step 2: Rodar testes**
Executar: `npm test -- tests/FinancialGoalsPreview.test.tsx tests/Transactions.test.tsx`

- [ ] **Step 3: Refatorar `Transactions.tsx` e criar `FinancialGoalsPreview.tsx`**
Estilizar histórico de transações com ícones e cores das categorias. Criar componente de Metas demonstrativo no padrão fintech.

- [ ] **Step 4: Rodar testes e validar aprovação**
Executar: `npm test -- tests/FinancialGoalsPreview.test.tsx tests/Transactions.test.tsx`
Esperado: PASS.

- [ ] **Step 5: Commit**
`git add apps/frontend/src/components/Transactions.tsx apps/frontend/src/components/FinancialGoalsPreview.tsx apps/frontend/tests/FinancialGoalsPreview.test.tsx apps/frontend/tests/Transactions.test.tsx`
`git commit -m "feat(transactions-goals): update transactions list and add fintech goals preview screen"`

---

### Task 7: MoneyHub IA (Tela Dedicada + Sugestões Rápidas + Gatilho Flutuante)

**Files:**
- Modify: `apps/frontend/src/components/AiAssistant.tsx`
- Test: `apps/frontend/tests/AiAssistant.test.tsx`

**Interfaces:**
- Consumes: `ASK_AI_ASSISTANT_MUTATION`, `AI_FINANCIAL_CONTEXT_QUERY`, `useTheme`.
- Produces: Componente de IA que pode ser exibido tanto como Tela Cheia (Módulo 7 da navegação) quanto como widget flutuante, com chips de sugestões pré-definidas.

- [ ] **Step 1: Atualizar testes em `AiAssistant.test.tsx`**
Cobrir o modo de tela cheia, clique nos chips de perguntas rápidas e envio de mensagens.

- [ ] **Step 2: Rodar testes e verificar falhas**
Executar: `npm test -- tests/AiAssistant.test.tsx`

- [ ] **Step 3: Refatorar `AiAssistant.tsx`**
Adicionar suporte ao modo de exibição em tela cheia (`viewMode: 'fullscreen' | 'floating'`), chips de sugestões rápidas no Dark Mode com bordas Indigo `#6366F1` e balões estilizados.

- [ ] **Step 4: Rodar testes e verificar aprovação**
Executar: `npm test -- tests/AiAssistant.test.tsx`
Esperado: PASS.

- [ ] **Step 5: Commit**
`git add apps/frontend/src/components/AiAssistant.tsx apps/frontend/tests/AiAssistant.test.tsx`
`git commit -m "feat(ai): add dedicated fullscreen chat view with quick prompt chips"`

---

### Task 8: Dashboard & Shell Integration (4 KPIs, Olho, Saldo Projetado, Grid 2 Colunas, Telas Auxiliares)

**Files:**
- Modify: `apps/frontend/src/components/DashboardShell.tsx`
- Modify: `apps/frontend/src/components/CashFlowChart.tsx`
- Modify: `apps/frontend/src/components/CategoryAnalysis.tsx`
- Modify: `apps/frontend/src/components/PeriodComparison.tsx`
- Modify: `apps/frontend/src/components/RecurringTransactions.tsx`
- Modify: `apps/frontend/src/components/CostCenters.tsx`
- Modify: `apps/frontend/src/components/Agenda.tsx`
- Modify: `apps/frontend/src/components/ProfileSettings.tsx`
- Modify: `apps/frontend/src/components/NotificationCenter.tsx`
- Test: `apps/frontend/tests/DashboardShell.test.tsx`
- Test: `apps/frontend/tests/FullFinancialFlow.test.tsx`

**Interfaces:**
- Integra todos os componentes desenvolvidos em `DashboardShell.tsx`.
- Conecta o botão de olho para ocultar valores (`R$ ••••••`).
- Calcula o Saldo Projetado (`Saldo Atual + Receber Pendente - Pagar Pendente`).
- Grid de 2 colunas no Desktop (Próximos Vencimentos + Progresso das Metas).

- [ ] **Step 1: Atualizar `DashboardShell.test.tsx` e `FullFinancialFlow.test.tsx`**
Adaptar os seletores de teste para o novo layout responsivo e validar a alternância de módulos.

- [ ] **Step 2: Rodar testes**
Executar: `npm test -- tests/DashboardShell.test.tsx tests/FullFinancialFlow.test.tsx`

- [ ] **Step 3: Refatorar `DashboardShell.tsx` e telas auxiliares**
Conectar `Sidebar`, `AppHeader`, `QuickPills` e `BottomNavBar`. Inserir o card com gradiente `#059669` -> `#0F766E` e alternador de olho. Conectar cálculo do Saldo Projetado e lista de Próximos Vencimentos com baixa rápida. Reestilizar gráficos e telas extras no tema.

- [ ] **Step 4: Rodar testes e verificar aprovação**
Executar: `npm test -- tests/DashboardShell.test.tsx tests/FullFinancialFlow.test.tsx`
Esperado: PASS.

- [ ] **Step 5: Commit**
`git add apps/frontend/src/components apps/frontend/tests`
`git commit -m "feat(dashboard): integrate responsive fintech shell with 4 KPIs, projected balance and restyled auxiliary screens"`

---

### Task 9: Validação Global, Typecheck Estrito e Suíte Completa de Testes

**Files:**
- To verify: Todo o código TypeScript em `apps/frontend`

- [ ] **Step 1: Executar verificação de tipos TypeScript**
Rodar no frontend: `npm run typecheck`
Esperado: 0 erros, sem nenhuma ocorrência de `any`.

- [ ] **Step 2: Executar auditoria de proibição de `any`**
Verificar se algum `as any` ou tipo `any` foi adicionado aos arquivos modificados. Corrigir imediatamente se houver.

- [ ] **Step 3: Executar a suíte de testes completa**
Rodar no frontend: `npm test`
Esperado: Todos os 35+ arquivos de teste passando com 100% de sucesso.

- [ ] **Step 4: Commit final de refinamento**
`git commit -m "chore: complete fintech visual redesign verification with strict typing and passing test suite"`
