import {
  buildSchema, coerceInputValue, getNamedType, graphql, isEnumType, isInputObjectType,
  isListType, isNonNullType, isObjectType, type GraphQLInputType, type GraphQLOutputType,
  type GraphQLSchema, type GraphQLFieldResolver
} from 'graphql';
import type { GraphQLContext } from '../../../core/graphql/graphql.js';
import type { LlmToolProperty } from '../llm-adapter/ai-llm-adapter.js';
import { badInput } from './validation.js';

// Explicit business capability registry: new API mutations require a reviewed entry.
export const OPERATIONS: Record<string, { label: string; entity?: string }> = {
  updateMyProfile: { label: 'Atualizar perfil', entity: 'profile' },
  createCategory: { label: 'Criar categoria', entity: 'category' },
  updateCategory: { label: 'Alterar categoria', entity: 'category' },
  deleteCategory: { label: 'Excluir categoria', entity: 'category' },
  createCostCenter: { label: 'Criar centro de custo', entity: 'costCenter' },
  updateCostCenter: { label: 'Alterar centro de custo', entity: 'costCenter' },
  deleteCostCenter: { label: 'Excluir centro de custo', entity: 'costCenter' },
  createIncome: { label: 'Registrar receita', entity: 'income' },
  updateIncome: { label: 'Alterar receita', entity: 'income' },
  deleteIncome: { label: 'Excluir receita', entity: 'income' },
  createExpense: { label: 'Registrar despesa', entity: 'expense' },
  updateExpense: { label: 'Alterar despesa', entity: 'expense' },
  deleteExpense: { label: 'Excluir despesa', entity: 'expense' },
  createAccountPayable: { label: 'Criar conta a pagar', entity: 'payable' },
  updateAccountPayable: { label: 'Alterar conta a pagar', entity: 'payable' },
  markAccountPayablePaid: { label: 'Registrar pagamento de conta', entity: 'payable' },
  deleteAccountPayable: { label: 'Excluir conta a pagar', entity: 'payable' },
  createAccountReceivable: { label: 'Criar conta a receber', entity: 'receivable' },
  updateAccountReceivable: { label: 'Alterar conta a receber', entity: 'receivable' },
  markAccountReceivableReceived: { label: 'Registrar recebimento de conta', entity: 'receivable' },
  deleteAccountReceivable: { label: 'Excluir conta a receber', entity: 'receivable' },
  createRecurringTransaction: { label: 'Criar recorrência', entity: 'recurring' },
  updateRecurringTransaction: { label: 'Alterar recorrência', entity: 'recurring' },
  deleteRecurringTransaction: { label: 'Excluir recorrência', entity: 'recurring' },
  processRecurringTransactions: { label: 'Gerar lançamentos das recorrências' },
  saveFinancialAccount: { label: 'Salvar conta bancária', entity: 'account' },
  createTransfer: { label: 'Criar transferência', entity: 'transfer' },
  changeTransfer: { label: 'Efetivar ou cancelar transferência', entity: 'transfer' },
  saveCreditCard: { label: 'Salvar cartão de crédito', entity: 'card' },
  recordCardPurchase: { label: 'Registrar compra no cartão' },
  payCreditCardStatement: { label: 'Pagar fatura do cartão', entity: 'cardPayment' },
  reverseCreditCardPayment: { label: 'Estornar pagamento de fatura', entity: 'cardPayment' },
  syncFinancialSeries: { label: 'Gerar ocorrências das séries financeiras' },
  cancelFinancialSeries: { label: 'Cancelar parcelas futuras da série', entity: 'series' },
  updateCommitmentSeries: { label: 'Alterar série financeira', entity: 'series' },
  createCommitmentSeries: { label: 'Criar lançamento ou série financeira', entity: 'series' },
  createFinancialGoal: { label: 'Criar meta financeira', entity: 'goal' },
  updateFinancialGoal: { label: 'Alterar meta financeira', entity: 'goal' },
  deleteFinancialGoal: { label: 'Excluir meta financeira', entity: 'goal' },
  recordFinancialGoalMovement: { label: 'Registrar aporte ou retirada da meta' },
  createCalendarEvent: { label: 'Criar evento na agenda', entity: 'event' },
  updateCalendarEvent: { label: 'Alterar evento na agenda', entity: 'event' },
  deleteCalendarEvent: { label: 'Excluir evento da agenda', entity: 'event' },
  syncAgendaNotifications: { label: 'Atualizar lembretes da agenda' },
  markNotificationRead: { label: 'Marcar notificação como lida', entity: 'notification' },
  markAllNotificationsRead: { label: 'Marcar todas as notificações como lidas' }
};
export const READ_OPERATIONS = [
  'myProfile', 'myCategories', 'myCostCenters', 'myIncomes', 'myExpenses',
  'myAccountsPayable', 'myAccountsReceivable', 'myRecurringTransactions', 'myAgenda',
  'myNotifications', 'dashboardSummary', 'cashFlow', 'categoryAnalysis', 'periodComparison',
  'aiFinancialContext', 'myFinancialAccounts', 'myTransfers', 'myCreditCards', 'creditCardBrands',
  'previewCommitmentSeries', 'myFinancialGoals', 'financialGoal', 'financialGoalsSummary'
];

function inputSchema(type: GraphQLInputType, depth = 0): LlmToolProperty {
  if (isNonNullType(type)) return inputSchema(type.ofType, depth);
  if (isListType(type)) return { type: 'array', items: inputSchema(type.ofType, depth + 1) };
  if (isEnumType(type)) return { type: 'string', enum: type.getValues().map(value => value.name) };
  if (isInputObjectType(type) && depth < 8) {
    const fields = Object.values(type.getFields());
    return { type: 'object', properties: Object.fromEntries(fields.map(field => [field.name, inputSchema(field.type, depth + 1)])),
      required: fields.filter(field => isNonNullType(field.type) && field.name !== 'operationId').map(field => field.name), additionalProperties: false };
  }
  return { type: type.name === 'Boolean' ? 'boolean' : ['Int', 'Float'].includes(type.name) ? 'number' : 'string' };
}

function selection(type: GraphQLOutputType, depth = 2): string {
  const named = getNamedType(type);
  if (!isObjectType(named)) return '';
  const fields = Object.values(named.getFields()).filter(field => !field.args.some(arg => isNonNullType(arg.type)));
  return '{ ' + fields.flatMap(field => {
    const nested = isObjectType(getNamedType(field.type));
    if (nested && depth <= 0) return [];
    return [field.name + (nested ? ' ' + selection(field.type, depth - 1) : '')];
  }).join(' ') + ' }';
}

export function createOperationCatalog(typeDefs: string, resolverMap: object) {
  const schema = buildSchema(typeDefs);
  for (const [typeName, handlers] of Object.entries(resolverMap)) {
    const type = schema.getType(typeName);
    if (!isObjectType(type) || !handlers || typeof handlers !== 'object') continue;
    for (const [fieldName, handler] of Object.entries(handlers)) {
      if (typeof handler === 'function' && type.getFields()[fieldName]) {
        type.getFields()[fieldName]!.resolve = handler as GraphQLFieldResolver<unknown, GraphQLContext>;
      }
    }
  }
  function field(name: string, mutation = true) {
    if (mutation ? !Object.hasOwn(OPERATIONS, name) : !READ_OPERATIONS.includes(name)) badInput('Operação não disponível.');
    const result = (mutation ? schema.getMutationType() : schema.getQueryType())?.getFields()[name];
    if (!result) badInput('Operação não encontrada na API.');
    return result;
  }
  return {
    graph: schema,
    list: () => Object.entries(OPERATIONS).map(([name, value]) => ({ name, description: value.label })),
    schema(name: string) {
      const operation = field(name, !READ_OPERATIONS.includes(name));
      return { name, description: OPERATIONS[name]?.label ?? name, arguments: {
        type: 'object', properties: Object.fromEntries(operation.args.map(arg => [arg.name, inputSchema(arg.type)])),
        required: operation.args.filter(arg => isNonNullType(arg.type)).map(arg => arg.name), additionalProperties: false
      } };
    },
    coerce(name: string, args: Record<string, unknown>, mutation = true) {
      const operation = field(name, mutation);
      for (const key of Object.keys(args)) if (!operation.args.some(arg => arg.name === key)) badInput(`Parâmetro desconhecido: ${key}.`);
      const result: Record<string, unknown> = {};
      for (const arg of operation.args) {
        const value = coerceInputValue(args[arg.name], arg.type, (_path, _invalid, error) => { badInput(error.message); });
        if (value !== undefined) result[arg.name] = value;
      }
      return result;
    },
    async invoke(context: GraphQLContext, name: string, args: Record<string, unknown>, mutation = true) {
      const operation = field(name, mutation);
      const definitions = operation.args.map(arg => `$${arg.name}: ${arg.type}`).join(', ');
      const parameters = operation.args.map(arg => `${arg.name}: $${arg.name}`).join(', ');
      const source = `${mutation ? 'mutation' : 'query'} Execute${definitions ? '(' + definitions + ')' : ''} { ${name}${parameters ? '(' + parameters + ')' : ''} ${selection(operation.type)} }`;
      const result = await graphql({ schema, source, variableValues: args, contextValue: context });
      if (result.errors?.length) throw result.errors[0];
      return result.data?.[name];
    }
  };
}
export type OperationCatalog = ReturnType<typeof createOperationCatalog>;
export function inputFields(schema: GraphQLSchema, operation: string) {
  const type = schema.getMutationType()?.getFields()[operation]?.args.find(arg => arg.name === 'input')?.type;
  const named = type && getNamedType(type);
  return named && isInputObjectType(named) ? named.getFields() : {};
}
