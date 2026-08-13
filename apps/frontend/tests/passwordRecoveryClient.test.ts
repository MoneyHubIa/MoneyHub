import {
  createPasswordRecoveryClient,
  resolvePasswordRecoveryEndpoint
} from '../src/services/passwordRecoveryClient';

function response({
  ok,
  status,
  body
}: {
  ok: boolean;
  status: number;
  body?: unknown;
}) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(body)
  };
}

describe('PasswordRecoveryClient', () => {
  test('requests backend recovery through the platform endpoint', async () => {
    const fetchRequest = jest.fn().mockResolvedValue(
      response({
        ok: true,
        status: 200,
        body: { success: true, data: { requested: true }, error: null }
      })
    );
    const client = createPasswordRecoveryClient({
      endpoint: 'https://moneyhub.example/auth/password-recovery',
      fetchRequest
    });

    await expect(client.request('person@example.com')).resolves.toBeUndefined();
    expect(fetchRequest).toHaveBeenCalledWith(
      'https://moneyhub.example/auth/password-recovery',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'person@example.com' })
      }
    );
  });

  test('rejects a backend refusal without exposing its response body', async () => {
    const client = createPasswordRecoveryClient({
      endpoint: '/auth/password-recovery',
      fetchRequest: jest.fn().mockResolvedValue(
        response({
          ok: false,
          status: 503,
          body: {
            success: false,
            error: {
              code: 'RECOVERY_UNAVAILABLE',
              message: 'Password recovery is temporarily unavailable.',
              details: { retryAfterSeconds: 60 }
            }
          }
        })
      )
    });

    await expect(client.request('invalid')).rejects.toMatchObject({
      code: 'auth/recovery-unavailable',
      message: 'Password recovery request failed.'
    });
    await client.request('invalid').catch((error: unknown) => {
      expect(JSON.stringify(error)).not.toContain('retryAfterSeconds');
      expect(error).not.toHaveProperty('details');
      expect(error).not.toHaveProperty('response');
    });
  });

  test('posts recovery code verification to backend verify endpoint', async () => {
    const fetchRequest = jest.fn().mockResolvedValue(
      response({
        ok: true,
        status: 200,
        body: {
          success: true,
          data: { valid: true },
          error: null
        }
      })
    );
    const client = createPasswordRecoveryClient({
      endpoint: '/auth/password-recovery',
      fetchRequest
    });

    await expect(client.verifyCode('valid-code')).resolves.toBeUndefined();
    expect(fetchRequest).toHaveBeenCalledWith(
      '/auth/password-recovery/verify',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ oobCode: 'valid-code' })
      }
    );
  });

  test('posts password confirmation to backend confirm endpoint', async () => {
    const fetchRequest = jest.fn().mockResolvedValue(
      response({
        ok: true,
        status: 200,
        body: {
          success: true,
          data: { confirmed: true },
          error: null
        }
      })
    );
    const client = createPasswordRecoveryClient({
      endpoint: '/auth/password-recovery',
      fetchRequest
    });

    await expect(client.confirm('valid-code', 'new-password')).resolves.toBeUndefined();
    expect(fetchRequest).toHaveBeenCalledWith(
      '/auth/password-recovery/confirm',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          oobCode: 'valid-code',
          newPassword: 'new-password'
        })
      }
    );
  });

  test('maps backend weak password errors to auth/weak-password', async () => {
    const client = createPasswordRecoveryClient({
      endpoint: '/auth/password-recovery',
      fetchRequest: jest.fn().mockResolvedValue(
        response({
          ok: false,
          status: 400,
          body: {
            success: false,
            error: {
              code: 'WEAK_PASSWORD',
              message: 'New password does not meet requirements.'
            }
          }
        })
      )
    });

    await expect(client.confirm('valid-code', 'weak')).rejects.toMatchObject({
      code: 'auth/weak-password'
    });
  });

  test('maps invalid or expired verify errors to auth/invalid-action-code without leaking details', async () => {
    const client = createPasswordRecoveryClient({
      endpoint: '/auth/password-recovery',
      fetchRequest: jest.fn().mockResolvedValue(
        response({
          ok: false,
          status: 400,
          body: {
            success: false,
            error: {
              code: 'INVALID_OR_EXPIRED_ACTION_CODE',
              message: 'Password recovery code could not be verified.',
              details: {
                providerMessage: 'auth/invalid-action-code?key=firebase-web-key'
              }
            }
          }
        })
      )
    });

    await expect(client.verifyCode('expired-code')).rejects.toMatchObject({
      code: 'auth/invalid-action-code',
      message: 'Password recovery verification failed.'
    });
    await client.verifyCode('expired-code').catch((error: unknown) => {
      expect(JSON.stringify(error)).not.toContain(
        'Password recovery code could not be verified.'
      );
      expect(JSON.stringify(error)).not.toContain(
        'auth/invalid-action-code?key=firebase-web-key'
      );
      expect(error).not.toHaveProperty('details');
      expect(error).not.toHaveProperty('response');
    });
  });

  test('maps invalid or expired confirm errors to auth/invalid-action-code without leaking details', async () => {
    const client = createPasswordRecoveryClient({
      endpoint: '/auth/password-recovery',
      fetchRequest: jest.fn().mockResolvedValue(
        response({
          ok: false,
          status: 400,
          body: {
            success: false,
            error: {
              code: 'INVALID_OR_EXPIRED_ACTION_CODE',
              message: 'Password recovery could not be confirmed.',
              details: {
                requestId: 'confirm-request-1',
                providerMessage: 'auth/expired-action-code'
              }
            }
          }
        })
      )
    });

    await expect(client.confirm('expired-code', 'new-password')).rejects.toMatchObject({
      code: 'auth/invalid-action-code',
      message: 'Password recovery confirmation failed.'
    });
    await client.confirm('expired-code', 'new-password').catch((error: unknown) => {
      expect(JSON.stringify(error)).not.toContain(
        'Password recovery could not be confirmed.'
      );
      expect(JSON.stringify(error)).not.toContain('confirm-request-1');
      expect(JSON.stringify(error)).not.toContain('auth/expired-action-code');
      expect(error).not.toHaveProperty('details');
      expect(error).not.toHaveProperty('response');
    });
  });

  test('maps unavailable backend confirm errors to auth/recovery-unavailable', async () => {
    const client = createPasswordRecoveryClient({
      endpoint: '/auth/password-recovery',
      fetchRequest: jest.fn().mockResolvedValue(
        response({
          ok: false,
          status: 503,
          body: {
            success: false,
            error: {
              code: 'RECOVERY_UNAVAILABLE',
              message: 'Password recovery is temporarily unavailable.',
              details: { requestId: 'confirm-request-1' }
            }
          }
        })
      )
    });

    await expect(client.confirm('valid-code', 'new-password')).rejects.toMatchObject({
      code: 'auth/recovery-unavailable',
      message: 'Password recovery confirmation failed.'
    });
    await client.confirm('valid-code', 'new-password').catch((error: unknown) => {
      expect(JSON.stringify(error)).not.toContain(
        'Password recovery is temporarily unavailable.'
      );
      expect(JSON.stringify(error)).not.toContain('confirm-request-1');
      expect(error).not.toHaveProperty('details');
      expect(error).not.toHaveProperty('response');
    });
  });

  test('maps backend rate limits to auth/too-many-requests', async () => {
    const client = createPasswordRecoveryClient({
      endpoint: '/auth/password-recovery',
      fetchRequest: jest.fn().mockResolvedValue(
        response({
          ok: false,
          status: 429,
          body: {
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'secret upstream throttling detail'
            }
          }
        })
      )
    });

    await expect(client.request('person@example.com')).rejects.toMatchObject({
      code: 'auth/too-many-requests',
      message: 'Password recovery request failed.'
    });
  });

  test('maps fetch failures to auth/network-request-failed without leaking details', async () => {
    const client = createPasswordRecoveryClient({
      endpoint: '/auth/password-recovery',
      fetchRequest: jest.fn().mockRejectedValue(
        new Error('request failed for oobCode=secret-action-code')
      )
    });

    await expect(client.verifyCode('secret-action-code')).rejects.toMatchObject({
      code: 'auth/network-request-failed',
      message: 'Password recovery verification failed.'
    });
    await client.verifyCode('secret-action-code').catch((error: unknown) => {
      expect(JSON.stringify(error)).not.toContain('secret-action-code');
      expect(error).not.toHaveProperty('cause');
      expect(error).not.toHaveProperty('response');
    });
  });

  test('does not leak server details on malformed backend verify responses', async () => {
    const client = createPasswordRecoveryClient({
      endpoint: '/auth/password-recovery',
      fetchRequest: jest.fn().mockResolvedValue(
        response({
          ok: false,
          status: 500,
          body: {
            success: false,
            error: {
              code: 'INVALID_OR_EXPIRED_ACTION_CODE',
              message: 'provider stack trace',
              details: { status: 400, upstream: 'firebase' }
            }
          }
        })
      )
    });

    await client.verifyCode('broken-code').catch((error: unknown) => {
      expect(JSON.stringify(error)).not.toContain('provider stack trace');
      expect(JSON.stringify(error)).not.toContain('"status":400');
      expect(JSON.stringify(error)).not.toContain('firebase');
      expect(error).toMatchObject({ code: 'auth/invalid-action-code' });
    });
  });

  test('uses same-origin on production web and APP_URL elsewhere', () => {
    expect(
      resolvePasswordRecoveryEndpoint(
        'https://moneyhub.example/base',
        'web',
        false
      )
    ).toBe('/auth/password-recovery');
    expect(
      resolvePasswordRecoveryEndpoint(
        'http://localhost:3000',
        'android',
        true
      )
    ).toBe('http://10.0.2.2:3000/auth/password-recovery');
  });

  test('builds verify and confirm URLs relative to resolved endpoint', async () => {
    const fetchRequest = jest.fn().mockResolvedValue(
      response({
        ok: true,
        status: 200,
        body: { success: true, data: { valid: true }, error: null }
      })
    );
    const client = createPasswordRecoveryClient({
      endpoint: 'https://moneyhub.example/auth/password-recovery',
      fetchRequest
    });

    await client.verifyCode('valid-code');
    await client.confirm('valid-code', 'new-password');

    expect(fetchRequest.mock.calls).toEqual([
      [
        'https://moneyhub.example/auth/password-recovery/verify',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ oobCode: 'valid-code' })
        }
      ],
      [
        'https://moneyhub.example/auth/password-recovery/confirm',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            oobCode: 'valid-code',
            newPassword: 'new-password'
          })
        }
      ]
    ]);
  });
});
