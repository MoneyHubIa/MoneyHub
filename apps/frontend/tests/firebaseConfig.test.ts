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
});
