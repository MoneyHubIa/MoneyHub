import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  createPasswordRecoveryService,
  type PasswordRecoveryAuditEvent
} from '../src/password-recovery.js';

type EmailMessage = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
};

type AuditEvent = Record<string, unknown>;

function setup(overrides: {
  generatePasswordResetLink?: (
    email: string,
    settings: { url: string; handleCodeInApp: boolean }
  ) => Promise<string>;
  sendEmail?: (
    message: EmailMessage,
    options: { idempotencyKey: string }
  ) => Promise<void>;
  providerTimeoutMs?: number;
} = {}) {
  const generated: Array<{ email: string; settings: unknown }> = [];
  const sent: Array<{ message: EmailMessage; options: { idempotencyKey: string } }> = [];
  const audit: AuditEvent[] = [];
  const dependencies = {
    appUrl: new URL('https://moneyhub.example/'),
    fromEmail: 'MoneyHub <security@moneyhub.example>',
    providerTimeoutMs: overrides.providerTimeoutMs,
    generatePasswordResetLink:
      overrides.generatePasswordResetLink ??
      (async (email, settings) => {
        generated.push({ email, settings });
        return 'https://moneyhub.example/reset-password?mode=resetPassword&oobCode=secret-code';
      }),
    sendEmail:
      overrides.sendEmail ??
      (async (message, options) => {
        sent.push({ message, options });
      }),
    audit: (event: PasswordRecoveryAuditEvent) => audit.push(event)
  };
  const service = createPasswordRecoveryService(dependencies);

  return { service, generated, sent, audit };
}

describe('password recovery service', () => {
  test('normalizes a known account and sends exactly one idempotent recovery email', async () => {
    const { service, generated, sent, audit } = setup();

    await service.request({
      email: ' User@Example.COM ',
      requestId: 'request-123'
    });

    assert.deepEqual(generated, [{
      email: 'user@example.com',
      settings: {
        url: 'https://moneyhub.example/login',
        handleCodeInApp: false
      }
    }]);
    assert.equal(sent.length, 1);
    assert.equal(sent[0]?.message.from, 'MoneyHub <security@moneyhub.example>');
    assert.deepEqual(sent[0]?.message.to, ['user@example.com']);
    assert.match(sent[0]?.message.subject ?? '', /MoneyHub/);
    assert.match(sent[0]?.message.html ?? '', /reset-password/);
    assert.match(sent[0]?.message.text ?? '', /reset-password/);
    assert.deepEqual(sent[0]?.options, {
      idempotencyKey: 'password-recovery/request-123'
    });
    assert.deepEqual(audit, [{
      event: 'password_recovery_requested',
      requestId: 'request-123',
      emailHash: 'b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514',
      status: 'sent'
    }]);
  });

  test('accepts an unknown account without sending email', async () => {
    const { service, sent, audit } = setup({
      generatePasswordResetLink: async () => {
        throw Object.assign(new Error('unknown account'), {
          code: 'auth/user-not-found'
        });
      }
    });

    await service.request({
      email: 'missing@example.com',
      requestId: 'unknown-request'
    });

    assert.equal(sent.length, 0);
    assert.equal(audit[0]?.status, 'unknown_user');
    assert.equal(audit[0]?.providerCode, 'auth/user-not-found');
    assert.doesNotMatch(JSON.stringify(audit), /missing@example\.com|unknown account/);
  });

  test('contains Firebase failure details to safe audit fields', async () => {
    const { service, sent, audit } = setup({
      generatePasswordResetLink: async () => {
        throw Object.assign(new Error('provider leaked user@example.com'), {
          code: 'auth/internal-error'
        });
      }
    });

    await service.request({
      email: 'user@example.com',
      requestId: 'firebase-failure'
    });

    assert.equal(sent.length, 0);
    assert.equal(audit[0]?.status, 'firebase_error');
    assert.equal(audit[0]?.providerCode, 'auth/internal-error');
    assert.doesNotMatch(JSON.stringify(audit), /user@example\.com|provider leaked/);
  });

  test('contains Resend failure without logging the email or action link', async () => {
    const actionLink =
      'https://moneyhub.example/reset-password?mode=resetPassword&oobCode=never-log-me';
    const { service, audit } = setup({
      generatePasswordResetLink: async () => actionLink,
      sendEmail: async () => {
        throw Object.assign(new Error(`failed for user@example.com at ${actionLink}`), {
          code: 'rate_limit_exceeded'
        });
      }
    });

    await service.request({
      email: 'user@example.com',
      requestId: 'resend-failure'
    });

    assert.equal(audit[0]?.status, 'email_error');
    assert.equal(audit[0]?.providerCode, 'rate_limit_exceeded');
    assert.doesNotMatch(
      JSON.stringify(audit),
      /user@example\.com|never-log-me|reset-password/
    );
  });

  test('bounds a stalled Firebase request and records a safe timeout', async () => {
    const { service, audit } = setup({
      providerTimeoutMs: 5,
      generatePasswordResetLink: () => new Promise(() => undefined)
    });

    await Promise.race([
      service.request({ email: 'user@example.com', requestId: 'firebase-timeout' }),
      new Promise((_, reject) => setTimeout(
        () => reject(new Error('service did not enforce its provider deadline')),
        50
      ))
    ]);

    assert.equal(audit[0]?.status, 'firebase_error');
    assert.equal(audit[0]?.providerCode, 'provider/timeout');
  });

  test('bounds a stalled Resend request and records a safe timeout', async () => {
    const { service, audit } = setup({
      providerTimeoutMs: 5,
      sendEmail: () => new Promise(() => undefined)
    });

    await Promise.race([
      service.request({ email: 'user@example.com', requestId: 'resend-timeout' }),
      new Promise((_, reject) => setTimeout(
        () => reject(new Error('service did not enforce its provider deadline')),
        50
      ))
    ]);

    assert.equal(audit[0]?.status, 'email_error');
    assert.equal(audit[0]?.providerCode, 'provider/timeout');
  });
});
