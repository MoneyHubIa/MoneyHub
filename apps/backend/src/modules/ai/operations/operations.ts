import { GraphQLError } from 'graphql';
import { randomUUID } from 'node:crypto';
import type { GraphQLContext } from '../../../core/graphql/graphql.js';
import { requireVerifiedUserId } from '../../finance/financial-categories/financial-categories.js';
import { appLogger } from '../../../core/http-logger/http-logger.js';
import { operationStore } from './store.js';
import { badInput, fingerprint, object, references, resolveReferences, safeError, UUID } from './validation.js';
import {
  json, publicPlan, type OperationPlan, type OperationRuntime, type OperationStore,
  type ProposedAction, type Arguments, type PublicPlan
} from './types.js';

export async function getAiOperationPlan(context: GraphQLContext, id: string, store = operationStore()): Promise<OperationPlan> {
  const userId = requireVerifiedUserId(context);
  if (!UUID.test(id)) badInput('Proposta não encontrada.', 'NOT_FOUND');
  const plan = await store.find(userId, id);
  if (!plan) badInput('Proposta não encontrada.', 'NOT_FOUND');
  return plan;
}
export async function prepareAiOperations(context: GraphQLContext, raw: unknown, runtime: OperationRuntime, previousPlanId?: string, store = operationStore()): Promise<PublicPlan> {
  const userId = requireVerifiedUserId(context);
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20) badInput('Prepare entre 1 e 20 ações por proposta. Divida pedidos maiores.');
  const previous = previousPlanId ? await getAiOperationPlan(context, previousPlanId, store) : null;
  const plan: OperationPlan = {
    id: randomUUID(), userId, status: 'PENDING', confirmedAt: null,
    createdAt: new Date(), expiresAt: new Date(Date.now() + 30 * 60 * 1000), actions: []
  };
  for (const [position, item] of raw.entries()) {
    const candidate = object(item);
    if (typeof candidate.key !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,59}$/.test(candidate.key) || plan.actions.some(action => action.key === candidate.key)) badInput('Cada ação precisa de uma chave única, iniciada por letra.');
    if (typeof candidate.operation !== 'string') badInput('Informe a operação.');
    let args = json<Arguments>(object(candidate.arguments));
    // A retry can reference previously successful steps, but can never re-execute them.
    if (previous?.confirmedAt) {
      const priorReferences = references(args).filter(key => !plan.actions.some(action => action.key === key));
      for (const key of priorReferences) {
        const referenced = previous.actions.find(action => action.key === key);
        if (referenced?.status !== 'SUCCEEDED') badInput('Inclua primeiro a ação pendente que fornece esta referência.');
      }
      if (priorReferences.length) args = resolveReferences(args, [...previous.actions.filter(action => priorReferences.includes(action.key)), ...plan.actions], true);
    }
    for (const key of references(args)) if (!plan.actions.some(action => action.key === key)) badInput('Uma referência deve apontar para uma ação anterior nesta proposta.');
    const id = randomUUID();
    const proposed: ProposedAction = { key: candidate.key, operation: candidate.operation, arguments: args };
    const prepared = await runtime.prepare(context, proposed, id, plan.actions);
    const signature = (operation: string, value: Arguments) => fingerprint({ operation, arguments: stripOperationId(value) });
    if (previous?.actions.some(action => action.status === 'SUCCEEDED' && signature(action.operation, action.arguments) === signature(proposed.operation, prepared.arguments))) badInput('Esta operação já foi concluída. Revise somente as pendências.');
    plan.actions.push({ ...proposed, ...prepared, id, position, status: 'PENDING', result: null, error: null });
  }
  await store.transaction(async transaction => {
    if (previous) {
      const locked = await transaction.lock(userId, previous.id);
      if (!locked) badInput('Proposta anterior não encontrada.', 'NOT_FOUND');
      if (locked.status === 'EXECUTING') badInput('Aguarde a execução da proposta anterior.', 'CONFLICT');
      if (locked.status === 'PENDING') await transaction.setPlan(previous.id, { status: 'CANCELLED' });
    }
    await transaction.create(plan);
  });
  return publicPlan(plan);
}
function stripOperationId(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripOperationId);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'operationId').map(([key, item]) => [key, stripOperationId(item)]));
  return value;
}

export async function cancelAiOperationPlan(context: GraphQLContext, id: string, store = operationStore()): Promise<PublicPlan> {
  const plan = await getAiOperationPlan(context, id, store);
  await store.transaction(async transaction => {
    const locked = await transaction.lock(plan.userId, id);
    if (!locked) badInput('Proposta não encontrada.', 'NOT_FOUND');
    if (locked.confirmedAt) badInput('Esta proposta já foi confirmada. Consulte o resultado das ações.', 'CONFLICT');
    await transaction.setPlan(id, { status: 'CANCELLED' });
  });
  return publicPlan(await getAiOperationPlan(context, id, store));
}
export async function confirmAiOperationPlan(context: GraphQLContext, id: string, runtime: OperationRuntime, store: OperationStore = operationStore()): Promise<PublicPlan> {
  const initial = await getAiOperationPlan(context, id, store);
  await store.transaction(async transaction => {
    const plan = await transaction.lock(initial.userId, id);
    if (!plan) badInput('Proposta não encontrada.', 'NOT_FOUND');
    if (plan.status === 'CANCELLED' || plan.status === 'EXPIRED') badInput('Proposta cancelada ou expirada. Prepare um novo resumo.', 'CONFLICT');
    if (!plan.confirmedAt && plan.expiresAt.getTime() <= Date.now()) badInput('Proposta expirada. Prepare um novo resumo.', 'CONFLICT');
    if (!plan.confirmedAt) await transaction.setPlan(id, { status: 'EXECUTING', confirmedAt: new Date() });
  });
  // One short transaction per step allows partial completion and resumable confirmations.
  for (const item of initial.actions) {
    await store.transaction(async transaction => {
      const plan = await transaction.lock(initial.userId, id);
      if (!plan?.confirmedAt || plan.status === 'CANCELLED') badInput('Proposta não confirmada.', 'CONFLICT');
      const action = plan.actions.find(candidate => candidate.id === item.id)!;
      if (action.status !== 'PENDING') return;
      try {
        const result = await transaction.savepoint(async () => {
          const args = resolveReferences(action.arguments, plan.actions);
          await runtime.verify(context, action.snapshots);
          // Rebase later preconditions only when they still match the reviewed state.
          // RepeatableRead hides concurrent changes while including this action's writes.
          const later = [];
          for (const candidate of plan.actions.filter(item => item.position > action.position && item.status === 'PENDING')) {
            try { await runtime.verify(context, candidate.snapshots); later.push(candidate); }
            catch (error) { if (!(error instanceof GraphQLError) || error.extensions.code !== 'CONFLICT') throw error; }
          }
          const result = await runtime.execute(context, action.operation, args);
          for (const candidate of later) await transaction.setSnapshots(candidate.id, await runtime.refresh(context, candidate.snapshots));
          return result;
        });
        await transaction.setAction(action.id, { status: 'SUCCEEDED', result });
      } catch (error) {
        await transaction.setAction(action.id, {
          status: error instanceof Error && 'extensions' in error && (error.extensions as Arguments)?.code === 'DEPENDENCY_FAILED' ? 'BLOCKED' : 'FAILED',
          error: safeError(error)
        });
      }
    });
  }
  await store.transaction(async transaction => {
    const plan = await transaction.lock(initial.userId, id);
    if (!plan) badInput('Proposta não encontrada.', 'NOT_FOUND');
    const successes = plan.actions.filter(action => action.status === 'SUCCEEDED').length;
    await transaction.setPlan(id, { status: successes === plan.actions.length ? 'COMPLETED' : successes ? 'PARTIAL' : 'FAILED' });
  });
  const result = publicPlan(await getAiOperationPlan(context, id, store));
  try { appLogger.info({ event: 'ai_operations_result', requestId: context.requestId, userId: initial.userId, planId: id, status: result.status, actions: result.actions.map(action => ({ id: action.id, operation: action.operation, status: action.status })) }); } catch { /* Receipts remain authoritative if logging fails. */ }
  return result;
}
