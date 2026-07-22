import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createFirebaseVerifier } from '../src/auth.js';

describe('Firebase authentication verifier', () => {
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
});
