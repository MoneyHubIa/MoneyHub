import { GraphQLError } from 'graphql';
import { createHash } from 'node:crypto';
import { canonical } from '../../finance/banking/rules.js';
import type { Arguments, OperationAction } from './types.js';

export function badInput(message: string, code = 'BAD_USER_INPUT'): never {
  throw new GraphQLError(message, { extensions: { code } });
}
export function object(value: unknown): Arguments {
  if (!value || typeof value !== 'object' || Array.isArray(value)) badInput('Parâmetros devem ser um objeto.');
  return value as Arguments;
}
export const REFERENCE = /^\$ref:([A-Za-z][A-Za-z0-9_-]{0,59})\.id$/;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PLACEHOLDER_ID = '00000000-0000-4000-8000-000000000000';
export function mapValues(value: unknown, visit: (key: string, value: unknown) => unknown, key = ''): unknown {
  const mapped = visit(key, value);
  if (Array.isArray(mapped)) return mapped.map(item => mapValues(item, visit, key));
  if (mapped && typeof mapped === 'object') return Object.fromEntries(Object.entries(mapped).map(([name, item]) => [name, mapValues(item, visit, name)]));
  return mapped;
}
export function references(value: unknown): string[] {
  const keys = new Set<string>();
  mapValues(value, (_key, item) => { if (typeof item === 'string' && REFERENCE.test(item)) keys.add(item.match(REFERENCE)![1]!); return item; });
  return [...keys];
}
export function resolveReferences(args: Arguments, actions: OperationAction[], placeholders = false): Arguments {
  return mapValues(args, (_key, value) => {
    if (typeof value !== 'string' || !REFERENCE.test(value)) return value;
    const key = value.match(REFERENCE)![1];
    const action = actions.find(item => item.key === key);
    if (!action) badInput(`Referência de ação desconhecida: ${key}.`);
    if (placeholders && action.status === 'PENDING') return PLACEHOLDER_ID;
    if (action.status !== 'SUCCEEDED' || typeof action.result?.id !== 'string') badInput(`Ação dependente de ${key}, que não foi concluída.`, 'DEPENDENCY_FAILED');
    return action.result.id;
  }) as Arguments;
}
export function fingerprint(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
export function safeError(error: unknown): string {
  // Only domain messages are shown. SQL, provider errors and stack traces stay private.
  return error instanceof GraphQLError && ['BAD_USER_INPUT', 'NOT_FOUND', 'DEPENDENCY_FAILED', 'CONFLICT'].includes(String(error.extensions.code))
    ? error.message.slice(0, 1000) : 'Não foi possível concluir esta operação. Revise os dados e tente novamente.';
}
