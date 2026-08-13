import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  FirebaseAuthRestError,
  type FirebaseAuthRestClient
} from '../src/firebase-auth-rest.js';
import {
  createPasswordRecoveryService,
  PasswordRecoveryPublicError,
  type PasswordRecoveryAuditEvent
} from '../src/password-recovery.js';

type AuditEvent = Record<string, unknown>;

function setup(overrides: {
  client?: Partial<FirebaseAuthRestClient>;
  audit?: (event: PasswordRecoveryAuditEvent) => void;
} = {}) {
  const requests: Array<{
    email: string;
    continueUrl: string;
    userIp: string;
  }> = [];
  const verifications: string[] = [];
  const confirmations: Array<{ oobCode: string; newPassword: string }> = [];
  const audit: AuditEvent[] = [];

  const client: FirebaseAuthRestClient = {
    requestPasswordReset:
      overrides.client?.requestPasswordReset ??
      (async (input) => {
        requests.push(input);
      }),
    verifyPasswordResetCode:
      overrides.client?.verifyPasswordResetCode ??
      (async (oobCode) => {
        verifications.push(oobCode);
      }),
    confirmPasswordReset:
      overrides.client?.confirmPasswordReset ??
      (async (oobCode, newPassword) => {
        confirmations.push({ oobCode, newPassword });
      })
  };

  const service = createPasswordRecoveryService({
    appUrl: new URL('https://moneyhub.example/'),
    firebaseAuthRest: client,
    audit: (event) => {
      audit.push(event);
      overrides.audit?.(event);
    }
  });

  return { service, requests, verifications, confirmations, audit };
}

async function assertPublicError(
  operation: Promise<void>,
  code: 'INVALID_OR_EXPIRED_ACTION_CODE' | 'WEAK_PASSWORD' | 'RECOVERY_UNAVAILABLE'
) {
  await assert.rejects(
    () => operation,
    (error: unknown) => {
      assert.ok(error instanceof PasswordRecoveryPublicError);
      assert.equal(error.code, code);
      assert.equal(error.message, 'Password recovery operation failed.');
      return true;
    }
  );
}

describe('password recovery service', () => {
  test('request normalizes email and initiates Firebase password reset with audit hash', async () => {
    const { service, requests, audit } = setup();

    await service.request({
      email: ' User@Example.COM ',
      requestId: 'request-123',
      userIp: '203.0.113.9'
    });

    assert.deepEqual(requests, [{
      email: 'user@example.com',
      continueUrl: 'https://moneyhub.example/login',
      userIp: '203.0.113.9'
    }]);
    assert.deepEqual(audit, [{
      event: 'password_recovery_requested',
      requestId: 'request-123',
      emailHash: 'b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514',
      status: 'requested'
    }]);
  });

  test('request swallows EMAIL_NOT_FOUND and audits unknown user without leaking email', async () => {
    const { service, requests, audit } = setup({
      client: {
        requestPasswordReset: async () => {
          throw new FirebaseAuthRestError('EMAIL_NOT_FOUND');
        }
      }
    });

    await service.request({
      email: 'missing@example.com',
      requestId: 'request-unknown',
      userIp: '203.0.113.10'
    });

    assert.equal(requests.length, 0);
    assert.deepEqual(audit, [{
      event: 'password_recovery_requested',
      requestId: 'request-unknown',
      emailHash: '62065901fb8d47d884b2737489920faedfdf935aa5cd9e0c34cad99b99a6a91b',
      status: 'unknown_user',
      providerCode: 'EMAIL_NOT_FOUND'
    }]);
    assert.doesNotMatch(JSON.stringify(audit), /missing@example\.com/i);
  });

  test('request swallows internal Firebase failures and keeps audit payload secret-free', async () => {
    const { service, audit } = setup({
      client: {
        requestPasswordReset: async () => {
          throw new Error(
            'provider leak user@example.com api-key=key-123 actionCode=never-log password=hunter2'
          );
        }
      }
    });

    await service.request({
      email: 'user@example.com',
      requestId: 'request-failure',
      userIp: '203.0.113.11'
    });

    assert.deepEqual(audit, [{
      event: 'password_recovery_requested',
      requestId: 'request-failure',
      emailHash: 'b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514',
      status: 'firebase_error'
    }]);
    assert.doesNotMatch(
      JSON.stringify(audit),
      /user@example\.com|hunter2|never-log|provider leak|key-123/i
    );
  });

  test('request does not audit dangerous FirebaseAuthRestError providerCode values', async () => {
    const { service, audit } = setup({
      client: {
        requestPasswordReset: async () => {
          throw new FirebaseAuthRestError('api-key=hunter2');
        }
      }
    });

    await service.request({
      email: 'user@example.com',
      requestId: 'request-provider-code-leak',
      userIp: '203.0.113.12'
    });

    assert.deepEqual(audit, [{
      event: 'password_recovery_requested',
      requestId: 'request-provider-code-leak',
      emailHash: 'b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514',
      status: 'firebase_error'
    }]);
    assert.doesNotMatch(JSON.stringify(audit), /api-key|hunter2/i);
  });

  test('verify records verified audit event on success', async () => {
    const { service, verifications, audit } = setup();

    await service.verify({
      oobCode: 'oob-code-123',
      requestId: 'verify-123'
    });

    assert.deepEqual(verifications, ['oob-code-123']);
    assert.deepEqual(audit, [{
      event: 'password_recovery_code_verified',
      requestId: 'verify-123',
      status: 'verified'
    }]);
  });

  test('verify maps invalid and expired action codes to INVALID_OR_EXPIRED_ACTION_CODE', async () => {
    for (const providerCode of ['INVALID_OOB_CODE', 'EXPIRED_OOB_CODE']) {
      const { service, audit } = setup({
        client: {
          verifyPasswordResetCode: async () => {
            throw new FirebaseAuthRestError(providerCode);
          }
        }
      });

      await assertPublicError(
        service.verify({
          oobCode: `secret-${providerCode}`,
          requestId: providerCode
        }),
        'INVALID_OR_EXPIRED_ACTION_CODE'
      );

      assert.deepEqual(audit, [{
        event: 'password_recovery_code_verified',
        requestId: providerCode,
        status: 'invalid_code',
        providerCode
      }]);
      assert.doesNotMatch(JSON.stringify(audit), /secret-/i);
    }
  });

  test('verify maps unexpected failures to RECOVERY_UNAVAILABLE and redacts provider message', async () => {
    const { service, audit } = setup({
      client: {
        verifyPasswordResetCode: async () => {
          throw new Error('verify failed for secret-code api-key=key-456');
        }
      }
    });

    await assertPublicError(
      service.verify({
        oobCode: 'secret-code',
        requestId: 'verify-failure'
      }),
      'RECOVERY_UNAVAILABLE'
    );

    assert.deepEqual(audit, [{
      event: 'password_recovery_code_verified',
      requestId: 'verify-failure',
      status: 'firebase_error'
    }]);
    assert.doesNotMatch(JSON.stringify(audit), /secret-code|verify failed|key-456/i);
  });

  test('verify does not audit dangerous generic providerCode values', async () => {
    const { service, audit } = setup({
      client: {
        verifyPasswordResetCode: async () => {
          throw { providerCode: 'hunter2/api-key' };
        }
      }
    });

    await assertPublicError(
      service.verify({
        oobCode: 'secret-verify',
        requestId: 'verify-provider-code-leak'
      }),
      'RECOVERY_UNAVAILABLE'
    );

    assert.deepEqual(audit, [{
      event: 'password_recovery_code_verified',
      requestId: 'verify-provider-code-leak',
      status: 'firebase_error'
    }]);
    assert.doesNotMatch(JSON.stringify(audit), /secret-verify|api-key|hunter2/i);
  });

  test('confirm records confirmed audit event on success', async () => {
    const { service, confirmations, audit } = setup();

    await service.confirm({
      oobCode: 'confirm-code-123',
      newPassword: 'Sup3rS3cret!',
      requestId: 'confirm-123'
    });

    assert.deepEqual(confirmations, [{
      oobCode: 'confirm-code-123',
      newPassword: 'Sup3rS3cret!'
    }]);
    assert.deepEqual(audit, [{
      event: 'password_recovery_confirmed',
      requestId: 'confirm-123',
      status: 'confirmed'
    }]);
  });

  test('confirm maps invalid and expired action codes to INVALID_OR_EXPIRED_ACTION_CODE', async () => {
    for (const providerCode of ['INVALID_OOB_CODE', 'EXPIRED_OOB_CODE']) {
      const { service, audit } = setup({
        client: {
          confirmPasswordReset: async () => {
            throw new FirebaseAuthRestError(providerCode);
          }
        }
      });

      await assertPublicError(
        service.confirm({
          oobCode: `secret-${providerCode}`,
          newPassword: 'Sup3rS3cret!',
          requestId: `confirm-${providerCode}`
        }),
        'INVALID_OR_EXPIRED_ACTION_CODE'
      );

      assert.deepEqual(audit, [{
        event: 'password_recovery_confirmed',
        requestId: `confirm-${providerCode}`,
        status: 'invalid_code',
        providerCode
      }]);
      assert.doesNotMatch(JSON.stringify(audit), /secret-|Sup3rS3cret!/i);
    }
  });

  test('confirm maps weak password provider codes to WEAK_PASSWORD', async () => {
    for (const providerCode of [
      'WEAK_PASSWORD',
      'PASSWORD_DOES_NOT_MEET_REQUIREMENTS'
    ]) {
      const { service, audit } = setup({
        client: {
          confirmPasswordReset: async () => {
            throw new FirebaseAuthRestError(providerCode);
          }
        }
      });

      await assertPublicError(
        service.confirm({
          oobCode: `weak-${providerCode}`,
          newPassword: 'weak-pass',
          requestId: `confirm-${providerCode}`
        }),
        'WEAK_PASSWORD'
      );

      assert.deepEqual(audit, [{
        event: 'password_recovery_confirmed',
        requestId: `confirm-${providerCode}`,
        status: 'weak_password',
        providerCode
      }]);
      assert.doesNotMatch(JSON.stringify(audit), /weak-|weak-pass/i);
    }
  });

  test('confirm maps all other failures to RECOVERY_UNAVAILABLE and redacts secrets', async () => {
    const { service, audit } = setup({
      client: {
        confirmPasswordReset: async () => {
          throw new Error(
            'confirm failed user@example.com oobCode=secret-456 password=Sup3rS3cret! api-key=key-789'
          );
        }
      }
    });

    await assertPublicError(
      service.confirm({
        oobCode: 'secret-456',
        newPassword: 'Sup3rS3cret!',
        requestId: 'confirm-failure'
      }),
      'RECOVERY_UNAVAILABLE'
    );

    assert.deepEqual(audit, [{
      event: 'password_recovery_confirmed',
      requestId: 'confirm-failure',
      status: 'firebase_error'
    }]);
    assert.doesNotMatch(
      JSON.stringify(audit),
      /user@example\.com|secret-456|Sup3rS3cret!|confirm failed|key-789/i
    );
  });

  test('confirm does not audit dangerous FirebaseAuthRestError providerCode values', async () => {
    const { service, audit } = setup({
      client: {
        confirmPasswordReset: async () => {
          throw new FirebaseAuthRestError('password=hunter2');
        }
      }
    });

    await assertPublicError(
      service.confirm({
        oobCode: 'secret-confirm',
        newPassword: 'Sup3rS3cret!',
        requestId: 'confirm-provider-code-leak'
      }),
      'RECOVERY_UNAVAILABLE'
    );

    assert.deepEqual(audit, [{
      event: 'password_recovery_confirmed',
      requestId: 'confirm-provider-code-leak',
      status: 'firebase_error'
    }]);
    assert.doesNotMatch(JSON.stringify(audit), /hunter2|secret-confirm|Sup3rS3cret!/i);
  });

  test('audit transport failure never changes public recovery behavior', async () => {
    const { service } = setup({
      client: {
        confirmPasswordReset: async () => {
          throw new FirebaseAuthRestError('WEAK_PASSWORD');
        }
      },
      audit: () => {
        throw new Error('logger offline');
      }
    });

    await assertPublicError(
      service.confirm({
        oobCode: 'secret-code',
        newPassword: 'Sup3rS3cret!',
        requestId: 'audit-failure'
      }),
      'WEAK_PASSWORD'
    );
  });
});
