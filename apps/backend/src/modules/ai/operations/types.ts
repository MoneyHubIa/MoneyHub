import { cents, money } from '../../finance/banking/rules.js';
import type { GraphQLContext } from '../../../core/graphql/graphql.js';

export type Arguments = Record<string, unknown>;
export type Detail = { label: string; before?: string | null; after: string };
export type Snapshot = { entity: string; id: string; hash: string };
export type ProposedAction = { key: string; operation: string; arguments: Arguments };
export type ActionStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'BLOCKED';
export type PlanStatus = 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
export type OperationAction = ProposedAction & {
  id: string; position: number; title: string; details: Detail[]; snapshots: Snapshot[];
  status: ActionStatus; result: Arguments | null; error: string | null;
};
export type OperationPlan = {
  id: string; userId: string; status: PlanStatus; confirmedAt: Date | null;
  createdAt: Date; expiresAt: Date; actions: OperationAction[];
};
export type PublicPlan = ReturnType<typeof publicPlan>;
export function publicPlan(plan: OperationPlan) {
  return {
    id: plan.id,
    status: plan.status === 'PENDING' && plan.expiresAt.getTime() <= Date.now() ? 'EXPIRED' : plan.status,
    confirmedAt: plan.confirmedAt?.toISOString() ?? null,
    createdAt: plan.createdAt.toISOString(), expiresAt: plan.expiresAt.toISOString(),
    totals: [...plan.actions.reduce((totals, action) => {
      if (!['createAccountPayable', 'createAccountReceivable', 'createIncome', 'createExpense', 'recordCardPurchase'].includes(action.operation)) return totals;
      const input = action.arguments.input as Arguments | undefined;
      if (typeof input?.amount !== 'string') return totals;
      const currency = action.details.find(detail => detail.label === 'Moeda')?.after ?? 'BRL';
      const key = action.operation + ':' + currency;
      totals.set(key, (totals.get(key) ?? 0n) + cents(input.amount));
      return totals;
    }, new Map<string, bigint>())].map(([key, total]) => {
      const [operation, currency] = key.split(':');
      const label = { createAccountPayable: 'Contas a pagar', createAccountReceivable: 'Contas a receber', createIncome: 'Receitas', createExpense: 'Despesas', recordCardPurchase: 'Compras no cartão' }[operation!] ?? operation;
      return `${label}: ${currency === 'BRL' ? 'R$' : currency} ${money(total).replace(/\B(?=(\d{3})+\.)/g, '.').replace(/\.(\d{2})$/, ',$1')}`;
    }),
    actions: plan.actions.map(({ id, key, operation, title, details, status, result, error }) => ({
      id, key, operation, title, details, status, error,
      resultJson: result === null ? null : JSON.stringify(result)
    }))
  };
}
export interface OperationRuntime {
  list(): { name: string; description: string }[];
  schema(name: string): unknown;
  read(context: GraphQLContext, name: string, args: Arguments, search?: string, offset?: number): Promise<unknown>;
  prepare(context: GraphQLContext, action: ProposedAction, id: string, previous: ProposedAction[]): Promise<{
    arguments: Arguments; title: string; details: Detail[]; snapshots: Snapshot[];
  }>;
  verify(context: GraphQLContext, snapshots: Snapshot[]): Promise<void>;
  refresh(context: GraphQLContext, snapshots: Snapshot[]): Promise<Snapshot[]>;
  execute(context: GraphQLContext, name: string, args: Arguments): Promise<Arguments>;
}
export interface OperationStore {
  find(userId: string, id: string): Promise<OperationPlan | null>;
  transaction<T>(work: (transaction: OperationTransaction) => Promise<T>): Promise<T>;
}
export interface OperationTransaction {
  lock(userId: string, id: string): Promise<OperationPlan | null>;
  create(plan: OperationPlan): Promise<void>;
  setPlan(id: string, data: { status?: PlanStatus; confirmedAt?: Date }): Promise<void>;
  setAction(id: string, data: { status: ActionStatus; result?: Arguments; error?: string }): Promise<void>;
  setSnapshots(id: string, snapshots: Snapshot[]): Promise<void>;
  savepoint<T>(work: () => Promise<T>): Promise<T>;
}
export function json<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
