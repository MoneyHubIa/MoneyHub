import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { PasswordRecoveryPublicError } from '../src/password-recovery.js';

const silentLogger = {
  info() {},
  warn() {},
  error() {}
};

const apps: Express[] = [];

afterEach(async () => {
  await Promise.all(apps.map((app) => app.locals.stop?.()));
  apps.length = 0;
});

async function recoveryApp(
  passwordRecovery: {
    request?: (input: {
      email: string;
      requestId: string;
      userIp: string;
    }) => Promise<void>;
    verify?: (input: { oobCode: string; requestId: string }) => Promise<void>;
    confirm?: (input: {
      oobCode: string;
      newPassword: string;
      requestId: string;
    }) => Promise<void>;
  },
  options: { now?: () => number } = {}
) {
  const app = await createApp({
    logger: silentLogger,
    ...(options.now ? { passwordRecoveryRateLimitNow: options.now } : {}),
    passwordRecovery: {
      request: passwordRecovery.request ?? (async () => undefined),
      verify: passwordRecovery.verify ?? (async () => undefined),
      confirm: passwordRecovery.confirm ?? (async () => undefined)
    }
  });
  apps.push(app);
  return app;
}

describe('password recovery route', () => {
  test('accepts a valid public request with the canonical response envelope', async () => {
    const app = await recoveryApp({});

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
    const acceptedApp = await recoveryApp({});
    const failedApp = await recoveryApp({
      request: async () => {
        throw new Error('provider unavailable');
      }
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
    const app = await recoveryApp({
      request: async () => {
        calls += 1;
      }
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

  test('forwards request.ip as userIp on initiation', async () => {
    let received:
      | { email: string; requestId: string; userIp: string }
      | undefined;
    const app = await recoveryApp({
      request: async (input) => {
        received = input;
      }
    });

    const response = await request(app)
      .post('/auth/password-recovery')
      .set('x-request-id', 'ip-forward-request')
      .send({ email: 'person@example.com' });

    assert.equal(response.status, 202);
    assert.deepEqual(received, {
      email: 'person@example.com',
      requestId: 'ip-forward-request',
      userIp: '::ffff:127.0.0.1'
    });
  });

  test('limits recovery to five requests per IP in fifteen minutes', async () => {
    const app = await recoveryApp({});

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

  test('keeps late recovery attempts across the fifteen-minute boundary', async () => {
    let now = 0;
    const app = await recoveryApp({}, { now: () => now });

    const first = await request(app)
      .post('/auth/password-recovery')
      .send({ email: 'person@example.com' });
    assert.equal(first.status, 202);

    now = 15 * 60 * 1000 - 1;
    for (let attempt = 2; attempt <= 5; attempt += 1) {
      const accepted = await request(app)
        .post('/auth/password-recovery')
        .send({ email: 'person@example.com' });
      assert.equal(accepted.status, 202);
    }
    const beforeBoundary = await request(app)
      .post('/auth/password-recovery')
      .send({ email: 'person@example.com' });
    assert.equal(beforeBoundary.status, 429);

    now = 15 * 60 * 1000;
    const oneExpired = await request(app)
      .post('/auth/password-recovery')
      .send({ email: 'person@example.com' });
    assert.equal(oneExpired.status, 202);
    const lateAttemptsRemain = await request(app)
      .post('/auth/password-recovery')
      .send({ email: 'person@example.com' });
    assert.equal(lateAttemptsRemain.status, 429);
  });

  test('verifies valid recovery code', async () => {
    let received: { oobCode: string; requestId: string } | undefined;
    const app = await recoveryApp({
      verify: async (input) => {
        received = input;
      }
    });

    const response = await request(app)
      .post('/auth/password-recovery/verify')
      .set('x-request-id', 'verify-request-1')
      .send({ oobCode: 'valid-code' });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      success: true,
      data: { valid: true },
      error: null,
      meta: { requestId: 'verify-request-1' }
    });
    assert.deepEqual(received, {
      oobCode: 'valid-code',
      requestId: 'verify-request-1'
    });
  });

  test('confirms valid recovery code with new password', async () => {
    let received:
      | { oobCode: string; newPassword: string; requestId: string }
      | undefined;
    const app = await recoveryApp({
      confirm: async (input) => {
        received = input;
      }
    });

    const response = await request(app)
      .post('/auth/password-recovery/confirm')
      .set('x-request-id', 'confirm-request-1')
      .send({ oobCode: 'valid-code', newPassword: 'strong-password' });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      success: true,
      data: { confirmed: true },
      error: null,
      meta: { requestId: 'confirm-request-1' }
    });
    assert.deepEqual(received, {
      oobCode: 'valid-code',
      newPassword: 'strong-password',
      requestId: 'confirm-request-1'
    });
  });

  test('rejects blank verify code without invoking service', async () => {
    let calls = 0;
    const app = await recoveryApp({
      verify: async () => {
        calls += 1;
      }
    });

    const response = await request(app)
      .post('/auth/password-recovery/verify')
      .set('x-request-id', 'blank-verify-code')
      .send({ oobCode: '   ' });

    assert.equal(response.status, 400);
    assert.equal(
      response.body.error.code,
      'INVALID_OR_EXPIRED_ACTION_CODE'
    );
    assert.equal(response.body.meta.requestId, 'blank-verify-code');
    assert.equal(calls, 0);
  });

  test('rejects blank confirm input without invoking service', async () => {
    let calls = 0;
    const app = await recoveryApp({
      confirm: async () => {
        calls += 1;
      }
    });

    const blankCode = await request(app)
      .post('/auth/password-recovery/confirm')
      .set('x-request-id', 'blank-confirm-code')
      .send({ oobCode: '   ', newPassword: 'strong-password' });

    assert.equal(blankCode.status, 400);
    assert.equal(
      blankCode.body.error.code,
      'INVALID_OR_EXPIRED_ACTION_CODE'
    );

    const blankPassword = await request(app)
      .post('/auth/password-recovery/confirm')
      .set('x-request-id', 'blank-confirm-password')
      .send({ oobCode: 'valid-code', newPassword: '' });

    assert.equal(blankPassword.status, 400);
    assert.equal(blankPassword.body.error.code, 'INVALID_PASSWORD');
    assert.equal(blankPassword.body.meta.requestId, 'blank-confirm-password');
    assert.equal(calls, 0);
  });

  test('uses INVALID_PASSWORD for every invalid confirmation password shape', async () => {
    let calls = 0;
    const app = await recoveryApp({
      confirm: async () => {
        calls += 1;
      }
    });

    const invalidPasswords: unknown[] = ['', 123, 'x'.repeat(4097)];
    for (const newPassword of invalidPasswords) {
      const response = await request(app)
        .post('/auth/password-recovery/confirm')
        .send({ oobCode: 'valid-code', newPassword });

      assert.equal(response.status, 400);
      assert.equal(response.body.error.code, 'INVALID_PASSWORD');
    }
    assert.equal(calls, 0);
  });

  test('returns 503 when verify and confirm recovery service wiring is absent', async () => {
    const app = await createApp({ logger: silentLogger });
    apps.push(app);

    const verify = await request(app)
      .post('/auth/password-recovery/verify')
      .send({ oobCode: 'valid-code' });
    const confirm = await request(app)
      .post('/auth/password-recovery/confirm')
      .send({ oobCode: 'valid-code', newPassword: 'strong-password' });

    assert.equal(verify.status, 503);
    assert.equal(verify.body.error.code, 'RECOVERY_UNAVAILABLE');
    assert.equal(confirm.status, 503);
    assert.equal(confirm.body.error.code, 'RECOVERY_UNAVAILABLE');
  });

  test('maps verify public errors to HTTP status codes', async () => {
    const invalidApp = await recoveryApp({
      verify: async () => {
        throw new PasswordRecoveryPublicError('INVALID_OR_EXPIRED_ACTION_CODE');
      }
    });
    const unavailableApp = await recoveryApp({
      verify: async () => {
        throw new PasswordRecoveryPublicError('RECOVERY_UNAVAILABLE');
      }
    });

    const invalid = await request(invalidApp)
      .post('/auth/password-recovery/verify')
      .set('x-request-id', 'invalid-verify-code')
      .send({ oobCode: 'invalid-code' });
    const unavailable = await request(unavailableApp)
      .post('/auth/password-recovery/verify')
      .set('x-request-id', 'verify-unavailable')
      .send({ oobCode: 'valid-code' });

    assert.equal(invalid.status, 400);
    assert.equal(
      invalid.body.error.code,
      'INVALID_OR_EXPIRED_ACTION_CODE'
    );
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.body.error.code, 'RECOVERY_UNAVAILABLE');
  });

  test('maps confirm public errors to HTTP status codes', async () => {
    const invalidApp = await recoveryApp({
      confirm: async () => {
        throw new PasswordRecoveryPublicError('INVALID_OR_EXPIRED_ACTION_CODE');
      }
    });
    const weakApp = await recoveryApp({
      confirm: async () => {
        throw new PasswordRecoveryPublicError('WEAK_PASSWORD');
      }
    });
    const unavailableApp = await recoveryApp({
      confirm: async () => {
        throw new PasswordRecoveryPublicError('RECOVERY_UNAVAILABLE');
      }
    });

    const invalid = await request(invalidApp)
      .post('/auth/password-recovery/confirm')
      .set('x-request-id', 'invalid-confirm-code')
      .send({ oobCode: 'invalid-code', newPassword: 'strong-password' });
    const weak = await request(weakApp)
      .post('/auth/password-recovery/confirm')
      .set('x-request-id', 'weak-confirm-password')
      .send({ oobCode: 'valid-code', newPassword: 'weak-password' });
    const unavailable = await request(unavailableApp)
      .post('/auth/password-recovery/confirm')
      .set('x-request-id', 'confirm-unavailable')
      .send({ oobCode: 'valid-code', newPassword: 'strong-password' });

    assert.equal(invalid.status, 400);
    assert.equal(
      invalid.body.error.code,
      'INVALID_OR_EXPIRED_ACTION_CODE'
    );
    assert.equal(weak.status, 400);
    assert.equal(weak.body.error.code, 'WEAK_PASSWORD');
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.body.error.code, 'RECOVERY_UNAVAILABLE');
  });

  test('uses separate verify and confirm rate limiters', async () => {
    const app = await recoveryApp({});

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const verifyResponse = await request(app)
        .post('/auth/password-recovery/verify')
        .send({ oobCode: 'valid-code' });
      assert.equal(verifyResponse.status, 200);
    }

    const verifyLimited = await request(app)
      .post('/auth/password-recovery/verify')
      .set('x-request-id', 'verify-limited')
      .send({ oobCode: 'valid-code' });

    assert.equal(verifyLimited.status, 429);
    assert.equal(verifyLimited.body.error.code, 'RATE_LIMITED');

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      const confirmResponse = await request(app)
        .post('/auth/password-recovery/confirm')
        .send({ oobCode: 'valid-code', newPassword: 'strong-password' });
      assert.equal(confirmResponse.status, 200);
    }

    const confirmLimited = await request(app)
      .post('/auth/password-recovery/confirm')
      .set('x-request-id', 'confirm-limited')
      .send({ oobCode: 'valid-code', newPassword: 'strong-password' });

    assert.equal(confirmLimited.status, 429);
    assert.equal(confirmLimited.body.error.code, 'RATE_LIMITED');
    assert.equal(confirmLimited.body.meta.requestId, 'confirm-limited');
  });
});
