import assert from 'node:assert/strict';
import { test } from 'node:test';
import { databaseUnavailableReason } from '../../../src/core/database/database-errors.js';

test('recognizes Prisma driver adapter saturation without treating every P2039 as unavailable', () => {
  const failure = {
    code: 'P2039',
    meta: { driverAdapterError: { cause: { kind: 'postgres', code: 'XX000', message: '(EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15' } } }
  };
  assert.equal(databaseUnavailableReason(failure), 'CONNECTION_LIMIT');
  for (const error of [{ code: '53300' }, { code: 'P2037' }, { cause: { kind: 'TooManyConnections' } },
    { cause: { code: 'XX000', message: '(EMAXCLIENTS) Max client connections reached' } }]) {
    assert.equal(databaseUnavailableReason(error), 'CONNECTION_LIMIT');
  }
  assert.equal(databaseUnavailableReason({ code: 'P2039', meta: { driverAdapterError: { cause: { kind: 'postgres', code: 'XX000', message: 'Unexpected database bug' } } } }), null);
});

test('classifies connectivity and timeout wrappers while preserving unexpected failures', () => {
  for (const error of [{ code: 'P1001' }, { code: 'P1017' }, { code: 'ECONNREFUSED' }, { code: '08006' }, { code: '57P03' }, { kind: 'DatabaseNotReachable' }, { cause: { kind: 'ConnectionClosed' } }]) {
    assert.equal(databaseUnavailableReason(error), 'DATABASE_UNAVAILABLE');
  }
  for (const error of [{ code: 'P2024' }, { code: 'ETIMEDOUT' }, { kind: 'SocketTimeout' }, new Error('timeout exceeded when trying to connect')]) {
    assert.equal(databaseUnavailableReason(error), 'CONNECTION_TIMEOUT');
  }
  const circular = { cause: null as unknown };
  circular.cause = circular;
  for (const error of [null, undefined, circular, new Error('SELECT private_column FROM private_table'), { code: 'P2002' }]) {
    assert.equal(databaseUnavailableReason(error), null);
  }
});
