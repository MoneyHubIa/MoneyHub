# Design Spec: Paginação em Transações, Modais em Contas a Pagar/Receber e Tema Escuro em Agenda/Recorrências/Centros de Custo

## 1. Visão Geral
Este documento especifica a modernização visual e de usabilidade do MoneyHub cobrindo três áreas centrais:
1. **Transações**: Introdução de paginação estruturada (10 itens por página) com navegação de páginas e melhoria dos filtros de busca e categoria.
2. **Contas a Pagar e Contas a Receber**: Remoção dos formulários inline fixos no topo, substituindo-os por botão de ação primária e modal flutuante reutilizável (`ThemedModal`) tanto para criação quanto para edição.
3. **Consistência de Tema Escuro**: Eliminação completa de cores hardcoded brancas/claras em `RecurringTransactions`, `CostCenters` e `Agenda`, integrando-os ao sistema central de design tokens (`useTheme`).

---

## 2. Requisitos e Comportamentos

### 2.1 Transações: Paginação e Filtros
- **Paginação**:
  - Exibição de 10 transações por página.
  - Seletor de navegação com botão "Anterior" (desabilitado na página 1) e "Próxima" (desabilitado na última página).
  - Indicador textual: `"Página X de Y"` e subtítulo `"Mostrando (início)-(fim) de (total) transações"`.
  - Mudança de filtro (busca, categoria ou tipo) redefine automaticamente a página atual para `1`.
- **Filtros**:
  - Chips de tipo de transação: `Todos`, `Receitas`, `Despesas`.
  - Campo de busca por texto em descrição ou categoria.
  - Chips horizontais com rolagem para filtrar diretamente por categoria.

### 2.2 Contas a Pagar e Contas a Receber: Modais Flutuantes
- **Layout Limpo**:
  - Remoção do formulário estático do topo da página. O topo passa a conter apenas o resumo financeiro (indicadores de vencidas, pendentes, quitadas) e o botão primário de ação (`"Nova Conta a Pagar"` ou `"Nova Conta a Receber"`).
- **Modal de Cadastro e Edição**:
  - Abertura com backdrop escurecido via `ThemedModal`.
  - Campos do formulário:
    - Descrição (`TextInput`)
    - Valor numérico (`TextInput` monetário)
    - Data de Vencimento (`DatePickerInput`)
    - Seleção de Categoria (chips/botões de seleção)
    - Seleção de Centro de Custo (chips/botões de seleção)
    - Antecedência de lembrete em dias (0 a 30 dias)
  - Botões de Ação: `Cancelar` e `Salvar Conta` / `Atualizar Conta`.
  - Ação de editar (ícone lápis na listagem) abre o mesmo modal preenchido com os dados do registro selecionado.

### 2.3 Correções de Tema Escuro
- **Recorrências (`RecurringTransactions.tsx`)**:
  - Utilizar `useTheme()` e aplicar `theme.bgSurface`, `theme.bgElevated`, `theme.borderElevated`, `theme.textPrimary` e `theme.textSecondary`.
  - Cartões de agendamento de recorrência e chips de tipo/frequência sem fundos brancos.
- **Centros de Custo (`CostCenters.tsx`)**:
  - Formulário e cartões de centro de custo com tokens de tema e bordas sutis.
- **Agenda (`Agenda.tsx`)**:
  - Grade de visualização de calendário e cartões de compromissos com suporte nativo ao dark mode.

---

## 3. Diretrizes Técnicas e Tipagem
- **TypeScript**: Estrita proibição de `any` ou `as any`.
- **Testes Unitários**: Atualização de `tests/Transactions.test.tsx`, `tests/AccountsPayable.test.tsx`, `tests/AccountsReceivable.test.tsx`, `tests/RecurringTransactions.test.tsx`, `tests/CostCenters.test.tsx` e `tests/Agenda.test.tsx`.
- **Compatibilidade**: Garantir que todos os 41 suites de testes permaneçam 100% aprovados.
