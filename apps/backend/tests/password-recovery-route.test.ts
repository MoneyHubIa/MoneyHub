import assert from 'node:assert/strict';
import { after, describe, test } from 'node:test';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';

const silentLogger = {
  info() {},
  warn() {},
  error() {}
};

const apps: Express[] = [];

after(async () => {
  await Promise.all(apps.map((app) => app.locals.stop?.()));
});

async function recoveryApp(
  requestPasswordRecovery: (input: {
    email: string;
    requestId: string;
  }) => Promise<void>
) {
  const app = await createApp({
    logger: silentLogger,
    passwordRecovery: { request: requestPasswordRecovery }
  });
  apps.push(app);
  return app;
}

describe('password recovery route', () => {
  test('accepts a valid public request with the canonical response envelope', async () => {
    const app = await recoveryApp(async () => undefined);

    const response = await request(app)
      .post('/auth/password-recovery')
      .set('x-request-id', 'recovery-request-1')
      .send({ email: 'person@example.com' });

    assert.equal(response.status, 202);
    assert.deepEqual(response.body, {
      success: true,
      data: { accepted: true },
      error: null,
      meta: { requestId: 'recovery-request-1' }
    });
  });

  test('returns identical public data when internal recovery fails', async () => {
    const acceptedApp = await recoveryApp(async () => undefined);
    const failedApp = await recoveryApp(async () => {
      throw new Error('provider unavailable');
    });

    const [accepted, failed] = await Promise.all([
      request(acceptedApp)
        .post('/auth/password-recovery')
        .set('x-request-id', 'same-request-id')
        .send({ email: 'known@example.com' }),
      request(failedApp)
        .post('/auth/password-recovery')
        .set('x-request-id', 'same-request-id')
        .send({ email: 'unknown@example.com' })
    ]);

    assert.equal(accepted.status, 202);
    assert.equal(failed.status, 202);
    assert.deepEqual(failed.body, accepted.body);
  });

  test('rejects invalid email input without invoking recovery', async () => {
    let calls = 0;
    const app = await recoveryApp(async () => {
      calls += 1;
    });

    const response = await request(app)
      .post('/auth/password-recovery')
      .set('x-request-id', 'invalid-email-request')
      .send({ email: 'not-an-email' });

    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, 'INVALID_EMAIL');
    assert.equal(response.body.meta.requestId, 'invalid-email-request');
    assert.equal(calls, 0);
  });

  test('limits recovery to five requests per IP in fifteen minutes', async () => {
    const app = await recoveryApp(async () => undefined);

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const accepted = await request(app)
        .post('/auth/password-recovery')
        .send({ email: 'person@example.com' });
      assert.equal(accepted.status, 202);
    }

    const limited = await request(app)
      .post('/auth/password-recovery')
      .set('x-request-id', 'limited-request')
      .send({ email: 'person@example.com' });

    assert.equal(limited.status, 429);
    assert.equal(limited.body.error.code, 'RATE_LIMITED');
    assert.equal(limited.body.meta.requestId, 'limited-request');
  });
});
