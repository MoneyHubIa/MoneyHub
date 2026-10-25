# Contratos da API

Palavras-chave: @api | graphql | rest | endpoints | queries | mutations | erros

O transporte de domínio é GraphQL. Use o schema executável para inputs,
nullability e retornos completos; a tabela abaixo é um mapa de localização.

## Entradas HTTP

| Método e rota | Uso |
| --- | --- |
| POST /graphql | Consultas e mutações de domínio. |
| GET /health | Saúde do processo; não verifica Firebase ou banco. |
| POST /auth/password-recovery | Solicitar recuperação por email. |
| POST /auth/password-recovery/verify | Validar oobCode. |
| POST /auth/password-recovery/confirm | Confirmar oobCode e newPassword. |

Operações autenticadas recebem Authorization: Bearer <Firebase ID token>.
Sem credencial, health e me são públicos; me retorna null.
Composição de identidade e permissões fica em [@auth](AUTH.md).

## Mapa GraphQL

| Domínio | Queries | Mutations |
| --- | --- | --- |
| Identidade/perfil | health, me, myProfile | bootstrapProfile, updateMyProfile |
| Categorias | myCategories | createCategory, updateCategory, deleteCategory |
| Centros | myCostCenters | createCostCenter, updateCostCenter, deleteCostCenter |
| Receitas | myIncomes | createIncome, updateIncome, deleteIncome |
| Despesas | myExpenses | createExpense, updateExpense, deleteExpense |
| A pagar | myAccountsPayable | createAccountPayable, updateAccountPayable, markAccountPayablePaid, deleteAccountPayable |
| A receber | myAccountsReceivable | createAccountReceivable, updateAccountReceivable, markAccountReceivableReceived, deleteAccountReceivable |
| Recorrências | myRecurringTransactions | createRecurringTransaction, updateRecurringTransaction, deleteRecurringTransaction, processRecurringTransactions |
| Indicadores | dashboardSummary, cashFlow, categoryAnalysis, periodComparison | — |
| Agenda | myAgenda | createCalendarEvent, updateCalendarEvent, deleteCalendarEvent |
| Notificações | myNotifications | syncAgendaNotifications, markNotificationRead, markAllNotificationsRead |
| Metas | myFinancialGoals, financialGoal, financialGoalsSummary | createFinancialGoal, updateFinancialGoal, deleteFinancialGoal, recordFinancialGoalMovement |
| IA | aiFinancialContext | askAiAssistant |

Campos adicionais de AuthUser incluem profile e needsProfileBootstrap.
Erros GraphQL usam errors[].extensions.code; não infira sucesso pelo HTTP 200.
UNAUTHENTICATED, EMAIL_NOT_VERIFIED e PROFILE_NOT_FOUND descrevem identidade;
BAD_USER_INPUT indica validação; FORBIDDEN/NOT_FOUND dependem do domínio;
SERVICE_UNAVAILABLE é o erro público de falha do adapter IA.

A validação de domínio ocorre em serviços; bootstrapProfile ainda valida
e usa Prisma no resolver. Não existe um utilitário único de erro para tudo.

## Recuperação: contratos REST

As respostas de rota usam success, data, error e meta.requestId.
Cada rota aceita JSON até 16 KiB. Firebase Auth REST tem timeout de 10 segundos.

| Rota | Corpo | Sucesso | Erros públicos |
| --- | --- | --- | --- |
| Solicitação | email | 202, data.accepted: true | 400 INVALID_EMAIL; 429 RATE_LIMITED. |
| Verificação | oobCode | 200, data.valid: true | 400 INVALID_OR_EXPIRED_ACTION_CODE; 429 RATE_LIMITED; 503 RECOVERY_UNAVAILABLE. |
| Confirmação | oobCode, newPassword | 200, data.confirmed: true | 400 INVALID_OR_EXPIRED_ACTION_CODE, INVALID_PASSWORD ou WEAK_PASSWORD; 429 RATE_LIMITED; 503 RECOVERY_UNAVAILABLE. |

Solicitação com email sintaticamente válido mantém resposta neutra para conta
existente, inexistente e falha do provedor. Indisponibilidade não é revelada
nessa rota de solicitação; verify/confirm possuem resposta temporária explícita.

O header x-request-id só é reaproveitado se satisfizer [A-Za-z0-9._-]{1,128};
caso contrário, gera UUID. A resposta ecoa o identificador.
Erros de parsing JSON ou limite de corpo não têm garantia do envelope meta.

## Contratos de domínio precisos

Dinheiro trafega como string decimal. Valores, datas, estado e idempotência
de metas estão em [@finance](FINANCE.md); não derive regras de negócio do formato
dos exemplos ou de nomes de campo.
O histórico de movimentos expõe nodes, hasNextPage e endCursor.

## Fontes

[Schema/resolvers](../apps/backend/src/core/graphql/graphql.ts),
[extensão de metas](../apps/backend/src/modules/finance/financial-goals/financial-goals-graphql.ts),
[rotas HTTP](../apps/backend/src/core/app/app.ts),
[adapter Firebase REST](../apps/backend/src/modules/auth/firebase-rest/firebase-auth-rest.ts).

Relacionados: [@auth](AUTH.md), [@finance](FINANCE.md), [@ai](AI.md), [@limits](LIMITS.md).
