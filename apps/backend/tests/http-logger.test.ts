import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { httpLogLevel } from '../src/http-logger.js';
import type {
  HttpCompletionEvent,
  HttpLogLevel,
  HttpLogger
} from '../src/http-logger.js';

type RecordedLog = Readonly<{
  level: HttpLogLevel;
  event: HttpCompletionEvent;
}>;

function recordingLogger(logs: RecordedLog[]): HttpLogger {
  return {
    info: (event) => logs.push({ level: 'info', event }),
    warn: (event) => logs.push({ level: 'warn', event }),
    error: (event) => logs.push({ level: 'error', event })
  };
}

async function testApp(logs: RecordedLog[]): Promise<Express> {
  return createApp({
    logger: recordingLogger(logs),
    verifyIdToken: async () => {
      throw new Error('Token must not be verified in anonymous tests.');
    }
  });
}

describe('HTTP request logging', () => {
  test('selects a log level from the final HTTP status', () => {
    assert.equal(httpLogLevel(200), 'info');
    assert.equal(httpLogLevel(399), 'info');
    assert.equal(httpLogLevel(400), 'warn');
    assert.equal(httpLogLevel(499), 'warn');
    assert.equal(httpLogLevel(500), 'error');
  });

  test('logs a successful health request with its correlation ID', async () => {
    const logs: RecordedLog[] = [];
    const app = await testApp(logs);
    const response = await request(app)
      .get('/health?probe=private-value')
      .set('x-request-id', 'request-health-1');

    assert.equal(response.status, 200);
    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.level, 'info');
    assert.equal(logs[0]?.event.requestId, response.headers['x-request-id']);
    assert.deepEqual(
      {
        ...logs[0]?.event,
        durationMs: undefined
      },
      {
        event: 'http_request_completed',
        requestId: 'request-health-1',
        method: 'GET',
        path: '/health',
        statusCode: 200,
        durationMs: undefined
      }
    );
    assert.ok(Number.isFinite(logs[0]?.event.durationMs));
    assert.ok((logs[0]?.event.durationMs ?? -1) >= 0);
    await app.locals.stop?.();
  });

  test('replaces a malicious request ID before response and logging', async () => {
    const logs: RecordedLog[] = [];
    const app = await testApp(logs);
    const maliciousRequestId = `secret-token:${'x'.repeat(200)}`;
    const response = await request(app)
      .get('/health')
      .set('x-request-id', maliciousRequestId);

    assert.equal(response.status, 200);
    assert.match(String(response.headers['x-request-id']), /^[0-9a-f-]{36}$/i);
    assert.notEqual(response.headers['x-request-id'], maliciousRequestId);
    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.event.requestId, response.headers['x-request-id']);
    assert.equal(JSON.stringify(logs).includes('secret-token'), false);
    await app.locals.stop?.();
  });

  test('accepts only bounded safe request IDs', async () => {
    const logs: RecordedLog[] = [];
    const app = await testApp(logs);
    const safeRequestId = 'request_2026-08-13.trace-01';
    const response = await request(app)
      .get('/health')
      .set('x-request-id', safeRequestId);

    assert.equal(response.status, 200);
    assert.equal(response.headers['x-request-id'], safeRequestId);
    assert.equal(logs[0]?.event.requestId, safeRequestId);
    await app.locals.stop?.();
  });

  test('logs a successful anonymous GraphQL request', async () => {
    const logs: RecordedLog[] = [];
    const app = await testApp(logs);
    const response = await request(app)
      .post('/graphql')
      .send({ query: '{ health { status } }' });

    assert.equal(response.status, 200);
    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.level, 'info');
    assert.equal(logs[0]?.event.path, '/graphql');
    await app.locals.stop?.();
  });

  test('logs a rejected GraphQL request without sensitive input', async () => {
    const logs: RecordedLog[] = [];
    const app = await testApp(logs);
    const response = await request(app)
      .post('/graphql')
      .set('authorization', 'Bearer secret-token')
      .send({ query: '{ health { status } }', variables: { secret: 'hidden' } });

    assert.equal(response.status, 401);
    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.level, 'warn');
    assert.equal(logs[0]?.event.path, '/graphql');
    assert.equal(JSON.stringify(logs[0]?.event).includes('secret'), false);
    await app.locals.stop?.();
  });

  test('logs an unknown route as a warning', async () => {
    const logs: RecordedLog[] = [];
    const app = await testApp(logs);
    const response = await request(app).get('/missing');

    assert.equal(response.status, 404);
    assert.equal(logs.length, 1);
    assert.equal(logs[0]?.level, 'warn');
    assert.equal(logs[0]?.event.statusCode, 404);
    await app.locals.stop?.();
  });
});
