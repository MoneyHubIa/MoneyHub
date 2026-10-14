# Especificação de Design: Redesign Fintech do MoneyHub

**Data:** 2026-10-14  
**Status:** Aprovado em Brainstorming  
**Autor:** Antigravity AI & Pair Developer  
**Escopo:** Frontend (React Native + Expo + React Native Web)

---

## 1. Visão Geral e Objetivos

O projeto **MoneyHub** possui um backend GraphQL robusto e um conjunto funcional de telas para gestão financeira. O objetivo desta especificação é refatorar completamente a camada visual e de navegação do frontend, aplicando um **Design System moderno de Fintech** com suporte nativo a **Dark Mode (padrão) e Light Mode**, adaptando-se automaticamente para **Web (Desktop)** e **Android (Mobile)** via layout responsivo (`width >= 1024px`).

### Princípios Chave:
1. **Preservação de Negócio:** 100% das mutations, queries GraphQL e regras existentes são mantidas intactas.
2. **TypeScript Estrito:** Proibição absoluta de `any` (uso estrito de tipos, interfaces e uniões seguras).
3. **Navegação Ergonômica:**
   - Web: Sidebar fixa à esquerda com os 7 módulos, badges de pendências e ações rápidas.
   - Android: Header compacto com alternador de tema/moeda, Quick Pills horizontais deslizáveis e Bottom Navigation Bar fixa com botão central flutuante `+` em `#10B981`.
4. **Separação Rigorosa dos Módulos:** Cada uma das 7 telas opera como módulo individual (Categorias e Metas totalmente segregadas).

---

## 2. Design System e Tokens Visuais (`frontend-design`)

### 2.1 Paleta de Cores Obrigatória

#### Dark Mode (Padrão do Sistema)
- `bgPrimary`: `#0B0F19` (Slate 950 profundo — nunca preto `#000000` puro)
- `bgSurface`: `#111827` (Cards, painéis e containers)
- `bgElevated`: `#1E293B` (Inputs, modais, itens internos e dropdowns)
- `border`: `#1E293B` (Bordas de cards e separadores, 1px)
- `borderElevated`: `#334155` (Bordas de inputs e caixas focadas)
- `textPrimary`: `#F8FAFC`
- `textSecondary`: `#94A3B8`
- `textMuted`: `#64748B`

#### Light Mode
- `bgPrimary`: `#F8FAFC` (Slate 50 claro)
- `bgSurface`: `#FFFFFF` (Cards brancos)
- `bgElevated`: `#F1F5F9` (Inputs e containers elevados)
- `border`: `#E2E8F0` (Borda sutil de 1px)
- `borderElevated`: `#CBD5E1` (Borda de inputs)
- `textPrimary`: `#0F172A`
- `textSecondary`: `#64748B`
- `textMuted`: `#94A3B8`

#### Cores Semânticas Fixas (Idênticas em Dark e Light)
- **Receitas / Entradas (`income`):** `#10B981` (Emerald 500) | Badge: `rgba(16, 185, 129, 0.15)`
- **Despesas / Saídas (`expense`):** `#F43F5E` (Rose 500) | Badge: `rgba(244, 63, 94, 0.15)`
- **Alertas / Atenção (`warning`):** `#F59E0B` (Amber 500) | Badge: `rgba(245, 158, 11, 0.15)`
- **MoneyHub IA / Destaque (`brandAI`):** `#6366F1` (Indigo 500) | Badge: `rgba(99, 102, 241, 0.15)`
- **Informação / Neutro (`info`):** `#06B6D4` (Cyan 500) | Badge: `rgba(6, 182, 212, 0.15)`

### 2.2 Geometria, Espaçamento e Tipografia
- **Raios de Borda:** `sm: 6px`, `md: 10px`, `lg: 14px`, `full: 9999px`.
- **Área de Toque/Interação Mínima:** `44x44px` para todos os botões e itens clicáveis.
- **Transições e Feedback:** Estados pressed/hover visíveis e suaves (200ms).

---

## 3. Arquitetura de Estado e Contextos

### 3.1 `ThemeContext` (`src/theme/ThemeContext.tsx`)
- Gerencia o estado `'dark' | 'light'` com valor inicial derivado do `AsyncStorage` (chave `@moneyhub:theme_mode`), caindo para `'dark'` como padrão absoluto.
- Sincronização em nuvem: ao alternar o tema, dispara silenciosamente a mutation `updateMyProfile(theme: ...)` se o usuário estiver autenticado.
- Hook exportado: `useTheme() => { theme: ColorTheme, isDark: boolean, toggleTheme: () => void, setThemeMode: (mode: 'dark' | 'light') => void }`.
- Controla dinamicamente a `StatusBar` do Expo (`style={isDark ? 'light' : 'dark'}`).

### 3.2 `useResponsive` (`src/theme/useResponsive.ts`)
- Utiliza `useWindowDimensions()` do React Native.
- Determina:
  - `isDesktop`: `width >= 1024`
  - `isMobile`: `width < 1024`

---

## 4. Estrutura de Navegação e Shell Adaptativo

### 4.1 Versão Web (Desktop — `width >= 1024px`)
- **Sidebar Fixa à Esquerda (260px):**
  - **Cabeçalho da Sidebar:** Ícone `WalletCards` esmeralda e marca **MoneyHub**.
  - **7 Módulos Principais:**
    1. Dashboard (`LayoutDashboard`)
    2. Transações (`WalletCards`)
    3. Contas a Pagar (`CalendarClock`) + badge de contagem de pendências
    4. Contas a Receber (`HandCoins`) + badge de contagem de pendências
    5. Categorias (`Tag`)
    6. Metas Financeiras (`Target`)
    7. MoneyHub IA (`Bot` ou `Sparkles` com acento Indigo)
  - **Grupo Secundário (Módulos Existentes Mantidos):**
    - Recorrências (`Repeat`)
    - Centros de Custo (`CreditCard`)
    - Agenda (`CalendarDays`)
  - **Bloco de Ações Rápidas (Inferior):**
    - Botões compactos: `+ A Pagar`, `+ A Receber`, `+ Categoria`.
  - **Rodapé:**
    - Botão de Ajustes (`Settings`) e Logout com confirmação.
- **AppHeader Superior:**
  - Título do módulo ativo e data atual.
  - Alternador Dark/Light (`Sun` / `Moon`).
  - Seletor de moeda de exibição (BRL / USD / EUR).
  - Ícone da Central de Notificações (`NotificationCenter`).

### 4.2 Versão Android / Mobile (`width < 1024px`)
- **Ocultação da Sidebar Lateral.**
- **Header Superior Mobile:**
  - Logotipo MoneyHub, botão de alternância Dark/Light, seletor de moeda e Central de Notificações.
- **Quick Pills Deslizáveis no Topo:**
  - Barra horizontal (`horizontal={true}`, `showsHorizontalScrollIndicator={false}`).
  - Pílulas com ícone + nome dos módulos para navegação com 1 toque.
  - Destaque visual na pílula ativa (`#10B981` ou `#6366F1` para IA).
- **Bottom Navigation Bar Fixa no Rodapé:**
  - Posicionamento com `SafeAreaView`.
  - 5 slots de acesso rápido:
    1. `Início` (Dashboard)
    2. `A Pagar` (com badge de pendências)
    3. **Botão Flutuante Central (`+` em `#10B981` com diâmetro 54px):** Abre modal/sheet de Novo Lançamento Rápido (`Nova Conta a Pagar`, `Nova Conta a Receber`, `Nova Transação`, `Nova Categoria`).
    4. `Categorias`
    5. `Metas`

---

## 5. Especificação dos 7 Módulos Principais

### 5.1 Dashboard
- **4 KPIs no Topo:**
  1. **Saldo Atual (Card Gradiente Emerald `#059669` -> `#0F766E`):**
     - Botão de olho para ocultar valores (`R$ ••••••`).
     - Rodapé exibindo **Saldo Projetado** (`Saldo Atual + Receber Pendente - Pagar Pendente`).
  2. **Receitas Realizadas:** Valor consolidado recebido + valor previsto a receber no mês.
  3. **Despesas Realizadas:** Valor consolidado pago + valor pendente a pagar no mês.
  4. **Alertas de Vencimento:** Total de contas vencidas ou vencendo nos próximos 7 dias.
- **Grid Inferior (2 colunas Desktop, 1 coluna Mobile):**
  - **Próximos Vencimentos:** lista de contas a pagar e receber próximas do vencimento, com botão de baixa rápida em 1 clique ("Pagar" / "Receber").
  - **Progresso das Metas:** card com prévia do módulo de metas no novo design.
- **Gráficos Integrados:** `CashFlowChart`, `CategoryAnalysis` e `PeriodComparison` estilizados no tema.

### 5.2 Transações (Extrato)
- Histórico de entradas e saídas efetivadas com ícone e cor da categoria.
- Filtros por tipo (`Todas`, `Receitas`, `Despesas`) e busca por texto.
- Botão `+ Nova Transação` abrindo modal de cadastro.

### 5.3 Contas a Pagar (Tela Exclusiva)
- **3 KPIs no Topo:** *Total Pendente no Mês*, *Atrasadas / Vencendo Hoje* (em `#F43F5E`) e *Total Pago*.
- **Lista:** Descrição, categoria, vencimento, badge `Recorrente` e badge `Alerta X dias antes`.
- **Ação 1 Clique:** Botão "Pagar" que chama `markAccountPayableAsPaid` e atualiza a interface instantaneamente.
- **Modal `+ Nova Conta a Pagar`:** Descrição, valor, vencimento, categoria, centro de custo e lembrete.

### 5.4 Contas a Receber (Tela Exclusiva)
- **3 KPIs no Topo:** *Pendente de Recebimento*, *Já Recebido no Mês* e *Total Previsto*.
- **Lista:** Descrição, data prevista, categoria e botão de 1 clique "Receber" (`markAccountReceivableAsReceived`).
- **Modal `+ Nova Conta a Receber`:** Descrição, valor, data prevista e categoria.

### 5.5 Categorias (Tela Exclusiva)
- **Segregação Total:** tela própria sem misturar com metas.
- **Filtros por Tipo:** `Todas`, `Despesas`, `Receitas`.
- **Cards de Categoria:** Ícone, nome, badge de tipo (`Receita` ou `Despesa`), volume total movimentado no mês e botões de **Editar** e **Excluir**.
- **Modal `+ Cadastrar / Editar Categoria`:**
  - Campo Nome.
  - Seletor de Tipo: `Despesa` ou `Receita`.
  - **Seletor Visual de 9 Cores:** `#10B981`, `#06B6D4`, `#3B82F6`, `#6366F1`, `#8B5CF6`, `#EC4899`, `#F43F5E`, `#F59E0B`, `#84CC16`.
  - **Seletor de Ícones:** grade visual de ícones Lucide pré-definidos.

### 5.6 Metas Financeiras (Tela Exclusiva - Preview Estilizado)
- Tela exclusiva com o novo visual fintech.
- Cards demonstrativos de objetivos (ex: Reserva de Emergência, Viagem) com barra de progresso colorida, valor atual vs. alvo, percentual e botão de aporte desabilitado com aviso explicativo.

### 5.7 MoneyHub IA (Tela Dedicada)
- Interface de chat em tela cheia com avatar IA `#6366F1`.
- Chips de perguntas rápidas clicáveis com preenchimento instantâneo.
- Campo de mensagem com envio por Enter ou toque.
- Mantém também o gatilho de acesso rápido nas demais telas.

### 5.8 Telas Auxiliares (Recorrências, Centros, Agenda, Ajustes)
- Migração completa de estilos para o `ThemeContext` e componentes UI primitives.

---

## 6. Plano de Arquivos

### Arquivos Novos a Criar:
- `apps/frontend/src/theme/tokens.ts` (Tokens de cores, raios, espaçamentos)
- `apps/frontend/src/theme/ThemeContext.tsx` (Provedor de tema, persistência AsyncStorage e hook `useTheme`)
- `apps/frontend/src/theme/useResponsive.ts` (Hook responsivo `isDesktop` width >= 1024)
- `apps/frontend/src/components/ui/Card.tsx`
- `apps/frontend/src/components/ui/KpiCard.tsx`
- `apps/frontend/src/components/ui/Badge.tsx`
- `apps/frontend/src/components/ui/Button.tsx`
- `apps/frontend/src/components/ui/ThemedModal.tsx`
- `apps/frontend/src/components/ui/Input.tsx`
- `apps/frontend/src/components/ui/ProgressBar.tsx`
- `apps/frontend/src/components/layout/AppHeader.tsx`
- `apps/frontend/src/components/layout/Sidebar.tsx`
- `apps/frontend/src/components/layout/QuickPills.tsx`
- `apps/frontend/src/components/layout/BottomNavBar.tsx`
- `apps/frontend/src/components/FinancialGoalsPreview.tsx`

### Arquivos a Refatorar:
- `apps/frontend/app/_layout.tsx` (Envolver aplicação no `ThemeProvider`)
- `apps/frontend/src/components/DashboardShell.tsx` (Integração com novo layout responsivo e controle de rotas internas)
- `apps/frontend/src/components/AccountsPayable.tsx`
- `apps/frontend/src/components/AccountsReceivable.tsx`
- `apps/frontend/src/components/FinancialCategories.tsx`
- `apps/frontend/src/components/Transactions.tsx`
- `apps/frontend/src/components/AiAssistant.tsx`
- `apps/frontend/src/components/CashFlowChart.tsx`
- `apps/frontend/src/components/CategoryAnalysis.tsx`
- `apps/frontend/src/components/PeriodComparison.tsx`
- `apps/frontend/src/components/RecurringTransactions.tsx`
- `apps/frontend/src/components/CostCenters.tsx`
- `apps/frontend/src/components/Agenda.tsx`
- `apps/frontend/src/components/ProfileSettings.tsx`
- `apps/frontend/src/components/NotificationCenter.tsx`

---

## 7. Critérios de Aceitação e Testes

1. **Compilação e Tipagem:** `npm run typecheck` sem qualquer erro e sem introduzir `any`.
2. **Suíte de Testes:** `npm test` passando em todos os testes unitários do frontend.
3. **Persistência do Tema:** Alterar para Light/Dark persiste após recarregar a aplicação e reflete no `StatusBar`.
4. **Comportamento Responsivo:**
   - Em resolução Desktop (>= 1024px), a Sidebar é visível e o BottomNavBar/QuickPills são ocultados.
   - Em resolução Mobile (< 1024px), a Sidebar é oculta, QuickPills e BottomNavBar estão visíveis e funcionais.
5. **Ações em 1 Clique:** Baixa de Contas a Pagar e Receber funciona sem erros.
6. **Categorias:** Criação e edição com escolha visual de cor e ícone funcionando perfeitamente.
