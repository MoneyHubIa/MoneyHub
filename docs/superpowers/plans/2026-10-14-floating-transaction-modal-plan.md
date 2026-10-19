# Plano de Implementação: Janela Flutuante de Transações & Redesign Estético MoneyHub

- **Data**: 2026-10-14  
- **Spec de Referência**: [`docs/superpowers/specs/2026-10-14-floating-transaction-modal-design.md`](file:///c:/MoneyHub/MoneyHub/docs/superpowers/specs/2026-10-14-floating-transaction-modal-design.md)  
- **Status**: Pronto para execução em sessão futura  

---

## 1. Visão Geral das Tarefas

O plano consiste em 4 tarefas incrementais e isoladas para transformar o fluxo de criação de transações em uma janela flutuante com foco imersivo e modernizar o extrato:

1. **Tarefa 1: Componente `TransactionModal`**
   - Criar `apps/frontend/src/components/TransactionModal.tsx`.
   - Adicionar controle de estado, validação, toggle de despesa/receita, input de valor formatado, seletor de categorias coloridas e integração com as mutations Apollo (`CREATE_INCOME` / `CREATE_EXPENSE`).
   - Garantir 0 ocorrências de `any` em estrita aderência à regra TypeScript do projeto.

2. **Tarefa 2: Integração da Janela Flutuante no `DashboardShell`**
   - Inserir botão de destaque `+ Nova Transação` no topo do Dashboard ao lado dos seletores de período e privacidade.
   - Conectar o estado `isTransactionModalOpen` e renderizar o `<TransactionModal />` no nível superior do shell.
   - Refletir atualizações instantâneas no saldo previsto e KPIs via cache do Apollo.

3. **Tarefa 3: Reformulação da Aba `Transactions.tsx`**
   - Remover o formulário estático de cadastro que ocupa o topo da tela.
   - Inserir header com métricas do mês e botão de ação primária `+ Nova Transação` (acionando o modal).
   - Adicionar barra de filtros por tipo (Todas / Receitas / Despesas) e campo de busca.
   - Atualizar a lista de movimentações com o estilo visual refinado do protótipo (ícones redondos com cores de categoria, badges de status `Pago`/`Pendente` e valores destacados).

4. **Tarefa 4: Verificação, Testes de Regressão e Validação Visual**
   - Executar checagem de tipos (`npm run typecheck` / lint).
   - Executar suíte de testes existente (`npm test`).
   - Validar responsividade em viewport mobile (<900px) e desktop (>=900px).

---

## 2. Detalhes Técnicos e Arquivos Alvo

- **Novo Arquivo**:
  - [`apps/frontend/src/components/TransactionModal.tsx`](file:///c:/MoneyHub/MoneyHub/apps/frontend/src/components/TransactionModal.tsx)
- **Arquivos a Modificar**:
  - [`apps/frontend/src/components/DashboardShell.tsx`](file:///c:/MoneyHub/MoneyHub/apps/frontend/src/components/DashboardShell.tsx)
  - [`apps/frontend/src/components/Transactions.tsx`](file:///c:/MoneyHub/MoneyHub/apps/frontend/src/components/Transactions.tsx)
