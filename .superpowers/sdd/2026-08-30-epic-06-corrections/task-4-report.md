# Task 4: Notification-center sync failure UX

## Implementação

- `NotificationCenter` recebe `syncError` e `onRetrySync`.
- Falha de sincronização aparece dentro do painel de notificações, com alerta acessível e botão `Tentar novamente`.
- Estado vazio continua visível separadamente da falha de sincronização.
- `DashboardShell` encaminha estado e retry de sincronização ao `NotificationCenter`; alerta duplicado na navegação foi removido.

## TDD

- RED: `npm test -w apps/frontend -- NotificationCenter.test.tsx DashboardShell.test.tsx` falhou porque não havia elemento com label `Falha de sincronização da agenda` no centro de notificações.
- GREEN: mesmo comando passou com 2 suítes e 15 testes.

## Verificação

- `npm run typecheck -w apps/frontend`: passou.
- `npm run lint -w apps/frontend`: falha preexistente, 14 erros não relacionados em `CashFlowChart.tsx`, `CategoryAnalysis.tsx`, `DatePickerInput.tsx`, `RecurringTransactions.tsx`, `VerifyEmailScreen.tsx`, `CashFlowChart.test.tsx`, `FinancialCategories.test.tsx` e `RecurringTransactions.test.tsx`.
