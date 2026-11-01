import { readFirebaseConfig } from '../src/services/firebaseConfig';

describe('Firebase public configuration', () => {
  test('maps Expo public variables without accepting secrets', () => {
    expect(readFirebaseConfig({
      EXPO_PUBLIC_FIREBASE_API_KEY: 'public-api-key',
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo-moneyhub',
      EXPO_PUBLIC_FIREBASE_APP_ID: 'app-id'
    })).toMatchObject({
      apiKey: 'public-api-key',
      authDomain: 'demo.firebaseapp.com',
      projectId: 'demo-moneyhub',
      appId: 'app-id'
    });
  });

  test('fails clearly when required Firebase configuration is absent', () => {
    expect(() => readFirebaseConfig({})).toThrow(
      'Firebase client configuration is incomplete.'
    );
  });

  test.each([
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_FIREBASE_APP_ID',
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID',
    'EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL'
  ])('rejects a redacted %s without exposing other values', (name) => {
    expect(() => readFirebaseConfig({
      EXPO_PUBLIC_FIREBASE_API_KEY: 'public-api-key',
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo-moneyhub',
      EXPO_PUBLIC_FIREBASE_APP_ID: 'app-id',
      [name]: ' [SENSITIVE] '
    })).toThrow(`${name} contains a Vercel redaction placeholder.`);
  });

  test('rejects a blank required variable', () => {
    expect(() => readFirebaseConfig({
      EXPO_PUBLIC_FIREBASE_API_KEY: '   ',
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo-moneyhub',
      EXPO_PUBLIC_FIREBASE_APP_ID: 'app-id'
    })).toThrow('Firebase client configuration is incomplete.');
  });
});
