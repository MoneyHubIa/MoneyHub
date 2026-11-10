import { gql } from '@apollo/client';

export type AiOperationPlan = {
  id: string; status: string; confirmedAt: string | null; createdAt: string; expiresAt: string;
  totals?: string[];
  actions: {
    id: string; key: string; operation: string; title: string; status: string;
    details: { label: string; before: string | null; after: string }[];
    resultJson: string | null; error: string | null;
  }[];
};
export const AI_OPERATION_PLAN_FRAGMENT = gql`
  fragment AiOperationPlanFields on AiOperationPlan {
    id status confirmedAt createdAt expiresAt totals
    actions { id key operation title status resultJson error details { label before after } }
  }
`;
export const CONFIRM_AI_OPERATION_PLAN = gql`
  mutation ConfirmAiOperationPlan($id: ID!) {
    confirmAiOperationPlan(id: $id) { ...AiOperationPlanFields }
  }
  ${AI_OPERATION_PLAN_FRAGMENT}
`;
export const CANCEL_AI_OPERATION_PLAN = gql`
  mutation CancelAiOperationPlan($id: ID!) {
    cancelAiOperationPlan(id: $id) { ...AiOperationPlanFields }
  }
  ${AI_OPERATION_PLAN_FRAGMENT}
`;
export const AI_OPERATION_PLAN_QUERY = gql`
  query AiOperationPlan($id: ID!) {
    aiOperationPlan(id: $id) { ...AiOperationPlanFields }
  }
  ${AI_OPERATION_PLAN_FRAGMENT}
`;
export function operationResultText(plan: AiOperationPlan): string {
  const successes = plan.actions.filter(action => action.status === 'SUCCEEDED').length;
  if (plan.status === 'CANCELLED') return 'Proposta cancelada. Nenhuma operação foi executada.';
  if (plan.status === 'EXPIRED') return 'Proposta expirada. Peça um novo resumo.';
  if (plan.status === 'PENDING') return 'Revise as operações abaixo e confirme para salvar.';
  return `${successes} de ${plan.actions.length} operações concluídas. ` + plan.actions.map(action => `${action.title}: ${action.status === 'SUCCEEDED' ? 'salvo' : action.status === 'PENDING' ? 'aguardando execução' : action.error ?? 'não concluído'}.`).join(' ');
}
