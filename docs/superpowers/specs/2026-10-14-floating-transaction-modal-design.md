# Especificação de Design: Janela Flutuante de Transações & Redesign Estético MoneyHub

- **Data**: 2026-10-14  
- **Status**: Planejado / Pronto para execução futura  
- **Contexto**: Inspiração no protótipo MoneyHub UI/UX Redesign 2.0 (`https://share.gemini.google/2m3wCZuMvU7I`)

---

## 1. Visão Geral e Objetivos

Atualmente, na aba `Transações` do MoneyHub, o formulário de cadastro de novas transações ocupa um bloco estático permanente no topo da tela, empurrando o histórico de movimentações para baixo e exigindo que o usuário navegue obrigatoriamente até a aba para realizar um lançamento.

### Objetivos do Redesign:
1. **Janela Flutuante (Floating Modal / Dialog)**:
   - Substituir o formulário fixo por um componente modal independente (`TransactionModal`), com visual moderno, foco imersivo, transição suave e validação instantânea.
   - Permitir acionar a janela flutuante a partir de qualquer ponto chave do sistema:
     - Botão vibrante `+ Nova Transação` no topo do Dashboard.
     - Botão `+ Nova Transação` no header da aba de Transações.
     - Suporte para atalho rápido no menu móvel/desktop.
2. **Transformação da Tela de Transações em Extrato Inteligente**:
   - Com a remoção do formulário estático, a tela `Transactions.tsx` ganha espaço para um extrato financeiro profissional inspirado no protótipo.
   - Inclusão de filtros rápidos por tipo (Todas, Receitas, Despesas), busca textual, badges coloridas com status (`Pago`/`Pendente`), agrupamento e indicação clara de categoria.
3. **Harmonização Visual com o Protótipo Redesign 2.0**:
   - Adoção das cores e contrastes refinados: roxo vibrante (`#6366F1`) para CTAs e IA, esmeralda (`#10B981`) para receitas e rosa neon (`#F43F5E`) para despesas.
   - Bordas sutis em `#1E293B` / `#334155` e fundos em camadas (`#0B0F19`, `#111827`, `#1E293B`).

---

## 2. Arquitetura de Componentes

```mermaid
graph TD
    DashboardShell[DashboardShell] --> HeaderActions[Header Actions]
    HeaderActions --> BtnNewTx[Botão '+ Nova Transação']
    BtnNewTx --> TransactionModal[TransactionModal (Janela Flutuante)]
    
    DashboardShell --> TransactionsView[Aba Transactions]
    TransactionsView --> TxHeader[Header do Extrato + Botão '+ Nova Transação']
    TxHeader --> TransactionModal
    TransactionsView --> TxFilterBar[Barra de Filtros e Busca]
    TransactionsView --> TxList[Lista de Transações / Extrato]
    
    TransactionModal --> GraphQLMutations[GraphQL Mutations: createIncome / createExpense]
    GraphQLMutations --> ApolloCache[Apollo Cache Refetch: DashboardSummary, MyTransactions]
```

### 2.1 Novo Componente: `TransactionModal.tsx`
- **Caminho**: `apps/frontend/src/components/TransactionModal.tsx`
- **Base**: Construído sobre o `ThemedModal` existente (`apps/frontend/src/components/ui/ThemedModal.tsx`), garantindo responsividade mobile/web e suporte a teclado.
- **Props**:
  ```typescript
  export interface TransactionModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess?: () => void;
    initialType?: 'INCOME' | 'EXPENSE';
  }
  ```
- **Campos e Controles do Modal**:
  1. **Seletor de Tipo**: Segmented control ou chips toggle para "Despesa" vs. "Receita" com feedback visual de cores vivas.
  2. **Valor em Destaque**: Input numérico de tamanho grande com formatação monetária e prefixo da moeda selecionada (ex: `R$ 0,00`).
  3. **Descrição**: Campo limpo com placeholder intuitivo (ex: *"Supermercado", "Salário"*).
  4. **Seletor de Categoria**: Grid ou dropdown horizontal com chips coloridos baseados nas categorias ativas cadastradas pelo usuário.
  5. **Data da Ocorrência**: Integração com `DatePickerInput` para facilitar agendamento ou alteração de data retroativa.
  6. **Ações de Rodapé**: Botão "Cancelar" e Botão primário "Confirmar Lançamento" (com spinner durante loading).

### 2.2 Reformulação de `Transactions.tsx`
- **Remoção**: Eliminar o `<Card style={styles.card}>` com o formulário fixo de cadastro.
- **Header Reformulado**:
  - Título limpo "Extrato & Movimentações".
  - Contador de lançamentos do mês e balanço líquido do período.
  - Botão de ação primária `+ Nova Transação` que abre o `TransactionModal`.
- **Filtros e Visualização**:
  - Chips de filtragem rápida: `Todas`, `Receitas`, `Despesas`.
  - Campo de busca instantânea por descrição ou categoria.
  - Cards de transação no padrão do protótipo:
    - Ícone circular colorido com a cor da categoria.
    - Descrição em destaque com metadados (Data, Categoria, Meio de pagamento/recorrência).
    - Badge clicável de status (`Pago` ou `Pendente`).
    - Valor com sinal e cor condicional (`+ R$ 8.500,00` em verde ou `- R$ 2.150,00` em vermelho/rosa).
    - Ação discreta de exclusão / edição.

### 2.3 Integração no `DashboardShell.tsx`
- O `DashboardShell` passa a controlar o estado global `isTransactionModalOpen`:
  ```typescript
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  ```
- No topo do Dashboard (ao lado do seletor de período e do botão de privacidade dos olhos), adiciona o botão com estilo vibrante:
  ```tsx
  <Pressable
    onPress={() => setIsTransactionModalOpen(true)}
    style={[styles.primaryCtaButton, { backgroundColor: theme.brandAI }]}
  >
    <Plus color="#FFFFFF" size={16} />
    <Text style={styles.primaryCtaText}>Nova Transação</Text>
  </Pressable>
  ```
- Renderiza `<TransactionModal visible={isTransactionModalOpen} onClose={() => setIsTransactionModalOpen(false)} />` na raiz do shell.

---

## 3. Diretrizes de Estilo e UX (Inspiradas no Protótipo)

| Elemento | Protótipo Redesign 2.0 | Implementação Proposta |
| :--- | :--- | :--- |
| **Backdrop da Janela** | Fundo escurecido com blur | `rgba(0, 0, 0, 0.7)` com `backdrop-filter: blur(8px)` |
| **Card do Modal** | Bordas finas, cantos arredondados (16px) | `theme.bgSurface`, borda `theme.borderElevated`, raio 16 |
| **Botão Nova Transação** | Roxo gradiente / vibrante com texto branco | `#6366F1` com ícone `Plus` e cantos arredondados (8-10px) |
| **Chips de Despesa/Receita** | Fundo suave com borda colorida ativa | `theme.expenseBadge` / `theme.incomeBadge` |
| **Badges de Status** | Pílula verde suave com ícone check | Tag `Pago` estilizada com borda sutil e texto legível |

---

## 4. Conformidade e Regras TypeScript

- **Regra Estrita**: Proibição total do uso de `any` ou `as any`.
- Todos os tipos de queries GraphQL (`MyTransactionsQuery`, `CreateIncomeInput`, `CreateExpenseInput`), categorias e dados de perfil devem possuir interfaces ou types estritamente declarados.
- Tratamento explícito de campos opcionais (`string | undefined`) e tipagem estrita de moedas (`'BRL' | 'USD' | 'EUR'`).

---

## 5. Roteiro de Execução (Para Implementação Futura)

1. **Fase 1: Criação do `TransactionModal`**
   - Criar `apps/frontend/src/components/TransactionModal.tsx` com mutations Apollo `CREATE_INCOME` e `CREATE_EXPENSE`.
   - Adicionar validações de formulário e feedback de erro/sucesso.
2. **Fase 2: Conexão no `DashboardShell`**
   - Inserir botão de disparo no topo do dashboard.
   - Posicionar a janela flutuante como overlay centralizado.
3. **Fase 3: Limpeza e Redesign de `Transactions.tsx`**
   - Retirar o formulário estático do topo.
   - Adicionar barra de pesquisa/filtros e o botão de ação no header.
   - Refinar a estilização dos itens do extrato para espelhar a lista de *Últimas Movimentações* do protótipo.
4. **Fase 4: Testes de Regressão e Validação Visual**
   - Testar o fluxo completo de cadastro de receita e despesa via janela flutuante.
   - Verificar atualização do saldo nos cards do Dashboard via cache Apollo.
