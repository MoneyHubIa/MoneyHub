export type DatabaseUnavailableReason = 'CONNECTION_LIMIT' | 'CONNECTION_TIMEOUT' | 'DATABASE_UNAVAILABLE';

const CONNECTION_LIMIT_CODES = new Set(['53300', 'P2037']);
const TIMEOUT_CODES = new Set(['ETIMEDOUT', 'P1002', 'P1008', 'P2024']);
const UNAVAILABLE_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH', 'EPIPE', '57P01', '57P02', '57P03', 'P1001', 'P1017']);

/** Inspect only known error wrappers. Never expose messages, query parameters or connection details. */
export function databaseUnavailableReason(error: unknown): DatabaseUnavailableReason | null {
  const seen = new Set<object>();
  const pending: unknown[] = [error];
  for (let index = 0; index < pending.length && index < 32; index += 1) {
    const item = pending[index];
    if (!item || typeof item !== 'object' || seen.has(item)) continue;
    seen.add(item);
    const value = item as Record<string, unknown>;
    const code = typeof value.code === 'string' ? value.code : '';
    const message = typeof value.message === 'string' ? value.message : '';
    if (CONNECTION_LIMIT_CODES.has(code) || value.kind === 'TooManyConnections'
      || /EMAXCONNSESSION|EMAXCLIENTS|max client connections reached/i.test(message)) return 'CONNECTION_LIMIT';
    if (TIMEOUT_CODES.has(code) || value.kind === 'SocketTimeout'
      || /timeout exceeded when trying to connect|connection (?:terminated due to )?timeout/i.test(message)) return 'CONNECTION_TIMEOUT';
    if (UNAVAILABLE_CODES.has(code) || /^08[A-Z0-9]{3}$/.test(code)
      || value.kind === 'DatabaseNotReachable' || value.kind === 'ConnectionClosed') return 'DATABASE_UNAVAILABLE';
    pending.push(value.cause, value.meta, value.driverAdapterError, value.originalError);
  }
  return null;
}
