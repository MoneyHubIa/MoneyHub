import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { resolveFirebaseAdminCredential } from '../../../../src/modules/auth/authentication/auth.js';

const serviceAccount = {
  project_id: 'moneyhub-production',
  client_email: 'firebase-admin@moneyhub-production.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nexample\n-----END PRIVATE KEY-----\n'
};

describe('Firebase Admin credential selection', () => {
  test('uses JSON secret and enables revoked-token checking', () => {
    const result = resolveFirebaseAdminCredential({
      FIREBASE_PROJECT_ID: 'moneyhub-production',
      FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(serviceAccount),
      GOOGLE_APPLICATION_CREDENTIALS: './missing.json'
    }, () => false);

    assert.deepEqual(result, {
      kind: 'json',
      serviceAccount: {
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key
      },
      checkRevoked: true
    });
  });

  test('rejects malformed JSON without including secret text in the error', () => {
    assert.throws(
      () => resolveFirebaseAdminCredential({
        FIREBASE_PROJECT_ID: 'moneyhub-production',
        FIREBASE_SERVICE_ACCOUNT_JSON: '{private-secret'
      }),
      (error: Error) => error.message.includes('FIREBASE_SERVICE_ACCOUNT_JSON')
        && !error.message.includes('private-secret')
    );
  });

  test('rejects missing fields without leaking the private key', () => {
    assert.throws(
      () => resolveFirebaseAdminCredential({
        FIREBASE_PROJECT_ID: 'moneyhub-production',
        FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ private_key: 'private-secret' })
      }),
      (error: Error) => !error.message.includes('private-secret')
    );
  });

  test('rejects project mismatch', () => {
    assert.throws(
      () => resolveFirebaseAdminCredential({
        FIREBASE_PROJECT_ID: 'different-project',
        FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(serviceAccount)
      }),
      /project_id does not match FIREBASE_PROJECT_ID/
    );
  });

  test('uses the local credentials file when no JSON secret is present', () => {
    const result = resolveFirebaseAdminCredential({
      GOOGLE_APPLICATION_CREDENTIALS: './credentials/admin.json'
    }, (path) => path === './credentials/admin.json');

    assert.deepEqual(result, { kind: 'file', checkRevoked: true });
  });

  test('allows Auth Emulator without a credentials file', () => {
    const result = resolveFirebaseAdminCredential({
      FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099'
    });

    assert.deepEqual(result, { kind: 'emulator', checkRevoked: false });
  });

  test('fails closed when Vercel has no Admin credentials', () => {
    assert.throws(
      () => resolveFirebaseAdminCredential({ VERCEL: '1' }),
      /Firebase Admin credentials are required on Vercel/
    );
  });

  test('does not accept an Auth Emulator setting as Vercel credentials', () => {
    assert.throws(
      () => resolveFirebaseAdminCredential({
        VERCEL: '1',
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099'
      }),
      /Firebase Admin credentials are required on Vercel/
    );
  });
});
