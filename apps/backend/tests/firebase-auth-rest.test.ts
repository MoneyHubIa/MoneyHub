import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  createFirebaseAuthRestClient,
  FirebaseAuthRestError
} from '../src/firebase-auth-rest.js';

type FetchRequest = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

function okResponse() {
  return new Response('{}', {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

function createClient(overrides: {
  fetchRequest?: FetchRequest;
  timeoutMs?: number;
} = {}) {
  const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchRequest = overrides.fetchRequest ?? (async () => okResponse());

  const client = createFirebaseAuthRestClient({
    apiKey: 'firebase-web-key',
    timeoutMs: overrides.timeoutMs ?? 50,
    fetchRequest: async (input, init) => {
      requests.push({ url: String(input), init });
      return fetchRequest(input, init);
    }
  });

  return { client, requests };
}

describe('Firebase Auth REST adapter', () => {
  test('requestPasswordReset posts exact Firebase password reset payload', async () => {
    const { client, requests } = createClient();

    await client.requestPasswordReset({
      email: 'user@example.com',
      continueUrl: 'https://moneyhub.example/login',
      userIp: '203.0.113.9'
    });

    assert.equal(requests.length, 1);
    assert.equal(
      requests[0]?.url,
      'https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=firebase-web-key'
    );
    assert.equal(requests[0]?.init?.method, 'POST');
    assert.equal(
      new Headers(requests[0]?.init?.headers).get('content-type'),
      'application/json'
    );
    assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), {
      requestType: 'PASSWORD_RESET',
      email: 'user@example.com',
      continueUrl: 'https://moneyhub.example/login',
      canHandleCodeInApp: false,
      userIp: '203.0.113.9'
    });
  });

  test('requestPasswordReset retries without continueUrl if rejected with UNAUTHORIZED_DOMAIN', async () => {
    let callCount = 0;
    const { client, requests } = createClient({
      fetchRequest: async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(
            JSON.stringify({
              error: { message: 'UNAUTHORIZED_DOMAIN : Domain not allowlisted by project' }
            }),
            { status: 400, headers: { 'content-type': 'application/json' } }
          );
        }
        return okResponse();
      }
    });

    await client.requestPasswordReset({
      email: 'user@example.com',
      continueUrl: 'http://192.168.1.18:3000/login',
      userIp: '203.0.113.9'
    });

    assert.equal(requests.length, 2);
    assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), {
      requestType: 'PASSWORD_RESET',
      email: 'user@example.com',
      continueUrl: 'http://192.168.1.18:3000/login',
      canHandleCodeInApp: false,
      userIp: '203.0.113.9'
    });
    assert.deepEqual(JSON.parse(String(requests[1]?.init?.body)), {
      requestType: 'PASSWORD_RESET',
      email: 'user@example.com',
      canHandleCodeInApp: false,
      userIp: '203.0.113.9'
    });
  });

  test('verifyPasswordResetCode posts only oobCode to resetPassword endpoint', async () => {
    const { client, requests } = createClient();

    await client.verifyPasswordResetCode('code');

    assert.equal(requests.length, 1);
    assert.equal(
      requests[0]?.url,
      'https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=firebase-web-key'
    );
    assert.equal(requests[0]?.init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), {
      oobCode: 'code'
    });
  });

  test('confirmPasswordReset posts oobCode and newPassword to resetPassword endpoint', async () => {
    const { client, requests } = createClient();

    await client.confirmPasswordReset('code', 'new-password');

    assert.equal(requests.length, 1);
    assert.equal(
      requests[0]?.url,
      'https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=firebase-web-key'
    );
    assert.equal(requests[0]?.init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(requests[0]?.init?.body)), {
      oobCode: 'code',
      newPassword: 'new-password'
    });
  });

  test('turns Firebase error body into sanitized FirebaseAuthRestError without leaking api key', async () => {
    const { client } = createClient({
      fetchRequest: async () => new Response(JSON.stringify({
        error: {
          message: 'auth/invalid-action-code?key=firebase-web-key'
        }
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      })
    });

    await assert.rejects(
      () => client.verifyPasswordResetCode('code'),
      (error: unknown) => {
        assert.ok(error instanceof FirebaseAuthRestError);
        assert.equal(error.providerCode, 'provider/unknown');
        assert.equal(error.message, 'Firebase Auth REST request failed.');
        assert.doesNotMatch(error.message, /firebase-web-key/);
        return true;
      }
    );
  });

  test('extracts the safe provider code before Firebase message details', async () => {
    const cases = [
      {
        message: 'WEAK_PASSWORD : Password should be at least 6 characters',
        providerCode: 'WEAK_PASSWORD'
      },
      {
        message:
          'PASSWORD_DOES_NOT_MEET_REQUIREMENTS : Password must contain an upper case character',
        providerCode: 'PASSWORD_DOES_NOT_MEET_REQUIREMENTS'
      },
      {
        message: 'INVALID_OOB_CODE : The action code is invalid',
        providerCode: 'INVALID_OOB_CODE'
      }
    ];

    for (const fixture of cases) {
      const { client } = createClient({
        fetchRequest: async () => new Response(JSON.stringify({
          error: { message: fixture.message }
        }), {
          status: 400,
          headers: { 'content-type': 'application/json' }
        })
      });

      await assert.rejects(
        () => client.confirmPasswordReset('code', 'new-password'),
        (error: unknown) => {
          assert.ok(error instanceof FirebaseAuthRestError);
          assert.equal(error.providerCode, fixture.providerCode);
          assert.doesNotMatch(error.message, /Password (?:should|must)/);
          return true;
        }
      );
    }
  });

  test('aborts stalled request and reports provider timeout before outer guard expires', async () => {
    let aborted = false;
    let signal: AbortSignal | undefined;
    const { client } = createClient({
      timeoutMs: 20,
      fetchRequest: async (_input, init) => {
        signal = init?.signal as AbortSignal | undefined;

        return new Promise<Response>((_resolve, reject) => {
          signal?.addEventListener(
            'abort',
            () => {
              aborted = true;
              reject(signal?.reason ?? new DOMException('This operation was aborted', 'AbortError'));
            },
            { once: true }
          );
        });
      }
    });

    await Promise.race([
      assert.rejects(
        () => client.requestPasswordReset({
          email: 'user@example.com',
          continueUrl: 'https://moneyhub.example/login',
          userIp: '203.0.113.9'
        }),
        (error: unknown) => {
          assert.ok(error instanceof FirebaseAuthRestError);
          assert.equal(error.providerCode, 'provider/timeout');
          assert.equal(error.message, 'Firebase Auth REST request failed.');
          assert.doesNotMatch(error.message, /firebase-web-key/);
          return true;
        }
      ),
      new Promise((_, reject) => setTimeout(
        () => reject(new Error('adapter did not abort within configured deadline')),
        200
      ))
    ]);

    assert.equal(aborted, true);
    assert.equal(signal?.aborted, true);
  });
});
