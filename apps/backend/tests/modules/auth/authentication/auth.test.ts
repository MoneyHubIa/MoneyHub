import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createFirebaseVerifier } from '../../../../src/modules/auth/authentication/auth.js';

describe('Firebase authentication verifier', () => {
  test('rejects token before reading identity or persistence', async () => {
    let getUserCalls = 0;
    let repositoryCalls = 0;
    const verifier = createFirebaseVerifier({
      verifyToken: async () => {
        throw new Error('invalid-token');
      },
      getUser: async () => {
        getUserCalls += 1;
        return {
          uid: 'unreachable',
          email: 'unreachable@example.com',
          emailVerified: false
        };
      },
      identityRepository: {
        synchronizeExistingIdentity: async () => {
          repositoryCalls += 1;
          return null;
        }
      }
    });

    await assert.rejects(verifier('invalid-token'), /invalid-token/);
    assert.equal(getUserCalls, 0);
    assert.equal(repositoryCalls, 0);
  });

  test('normalizes Firebase identity and returns existing local projection', async () => {
    let synchronizedEmail = '';
    const verifier = createFirebaseVerifier({
      verifyToken: async () => ({ uid: 'firebase-user-1' }),
      getUser: async () => ({
        uid: 'firebase-user-1',
        email: '  USER@Example.com ',
        emailVerified: true
      }),
      identityRepository: {
        synchronizeExistingIdentity: async (identity: { email: string }) => {
          synchronizedEmail = identity.email;
          return { userId: 'user-1', profileId: 'profile-1' };
        }
      }
    });

    const context = await verifier('valid-token');

    assert.equal(synchronizedEmail, 'user@example.com');
    assert.deepEqual(context, {
      uid: 'firebase-user-1',
      email: 'user@example.com',
      emailVerified: true,
      userId: 'user-1',
      profileId: 'profile-1'
    });
  });

  test('does not create a local projection when none exists', async () => {
    const verifier = createFirebaseVerifier({
      verifyToken: async () => ({ uid: 'firebase-user-2' }),
      getUser: async () => ({
        uid: 'firebase-user-2',
        email: 'new@example.com',
        emailVerified: false
      }),
      identityRepository: {
        synchronizeExistingIdentity: async () => null
      }
    });

    const context = await verifier('valid-token');

    assert.equal(context.userId, null);
    assert.equal(context.profileId, null);
  });

  test('rejects Firebase identities without email', async () => {
    const verifier = createFirebaseVerifier({
      verifyToken: async () => ({ uid: 'firebase-user-3' }),
      getUser: async () => ({
        uid: 'firebase-user-3',
        email: null,
        emailVerified: false
      }),
      identityRepository: {
        synchronizeExistingIdentity: async () => null
      }
    });

    await assert.rejects(verifier('valid-token'), {
      name: 'AUTH_EMAIL_REQUIRED'
    });
  });

  test('uses verified token claims when the Firebase user lookup is unavailable', async () => {
    const verifier = createFirebaseVerifier({
      verifyToken: async () => ({
        uid: 'firebase-user-4',
        email: 'FALLBACK@Example.com',
        email_verified: true
      }),
      getUser: async () => {
        throw new Error('Firebase Admin user lookup unavailable');
      },
      identityRepository: {
        synchronizeExistingIdentity: async () => null
      }
    });

    const context = await verifier('valid-token');

    assert.equal(context.email, 'fallback@example.com');
    assert.equal(context.emailVerified, true);
    assert.equal(Object.isFrozen(context), true);
  });

  test('propagates identity persistence failure without returning partial context', async () => {
    const verifier = createFirebaseVerifier({
      verifyToken: async () => ({ uid: 'firebase-user-5' }),
      getUser: async () => ({
        uid: 'firebase-user-5',
        email: 'user@example.com',
        emailVerified: true
      }),
      identityRepository: {
        synchronizeExistingIdentity: async () => {
          throw new Error('database unavailable');
        }
      }
    });

    await assert.rejects(verifier('valid-token'), /database unavailable/);
  });

  test('does not share context between consecutive identities', async () => {
    let uid = 'firebase-user-6';
    const verifier = createFirebaseVerifier({
      verifyToken: async () => ({ uid }),
      getUser: async (requestedUid) => ({
        uid: requestedUid,
        email: `${requestedUid}@example.com`,
        emailVerified: true
      }),
      identityRepository: {
        synchronizeExistingIdentity: async (identity) => ({
          userId: `local-${identity.uid}`,
          profileId: null
        })
      }
    });

    const first = await verifier('first-token');
    uid = 'firebase-user-7';
    const second = await verifier('second-token');

    assert.equal(first.uid, 'firebase-user-6');
    assert.equal(first.userId, 'local-firebase-user-6');
    assert.equal(second.uid, 'firebase-user-7');
    assert.equal(second.userId, 'local-firebase-user-7');
    assert.notEqual(first, second);
  });
});
