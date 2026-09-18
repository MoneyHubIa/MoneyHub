/* eslint-disable @typescript-eslint/no-require-imports */
describe('Firebase runtime boundaries', () => {
  const originalEmulatorUrl = process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.dontMock('firebase/app');
    jest.dontMock('firebase/auth');
    jest.dontMock('react-native');
    jest.dontMock('@react-native-async-storage/async-storage');
    jest.dontMock('../src/services/firebaseApp');
    delete process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL;
  });

  afterAll(() => {
    if (originalEmulatorUrl === undefined) {
      delete process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL;
    } else {
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL = originalEmulatorUrl;
    }
  });

  test('web auth initializes once and connects to configured emulator once', () => {
    const auth = { currentUser: null };
    const getAuth = jest.fn(() => auth);
    const connectAuthEmulator = jest.fn();
    jest.doMock('firebase/auth', () => ({ getAuth, connectAuthEmulator }));
    jest.doMock('../src/services/firebaseApp', () => ({
      getFirebaseApp: jest.fn(() => ({ name: 'app' }))
    }));
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';

    const { getFirebaseAuth } = require('../src/services/firebaseAuthRuntime.ts') as typeof import('../src/services/firebaseAuthRuntime');

    expect(getFirebaseAuth()).toBe(auth);
    expect(getFirebaseAuth()).toBe(auth);
    expect(getAuth).toHaveBeenCalledTimes(1);
    expect(connectAuthEmulator).toHaveBeenCalledTimes(1);
    expect(connectAuthEmulator).toHaveBeenCalledWith(
      auth,
      'http://127.0.0.1:9099',
      { disableWarnings: true }
    );
  });

  test('native auth uses persistent initialization and Android emulator URL', () => {
    const auth = { currentUser: null };
    const initializeAuth = jest.fn(() => auth);
    const getReactNativePersistence = jest.fn(() => 'persistence');
    const connectAuthEmulator = jest.fn();
    jest.doMock('firebase/auth', () => ({
      initializeAuth,
      getReactNativePersistence,
      connectAuthEmulator,
      getAuth: jest.fn()
    }));
    jest.doMock('react-native', () => ({ Platform: { OS: 'android' } }));
    jest.doMock('@react-native-async-storage/async-storage', () => ({
      __esModule: true,
      default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }
    }));
    jest.doMock('../src/services/firebaseApp', () => ({
      getFirebaseApp: jest.fn(() => ({ name: 'app' }))
    }));
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL = 'http://localhost:9099';

    const { getFirebaseAuth } = require('../src/services/firebaseAuthRuntime.native') as typeof import('../src/services/firebaseAuthRuntime.native');

    expect(getFirebaseAuth()).toBe(auth);
    expect(getFirebaseAuth()).toBe(auth);
    expect(initializeAuth).toHaveBeenCalledTimes(1);
    expect(getReactNativePersistence).toHaveBeenCalledTimes(1);
    expect(connectAuthEmulator).toHaveBeenCalledWith(
      auth,
      'http://10.0.2.2:9099/',
      { disableWarnings: true }
    );
  });

  test('native auth falls back to existing Firebase Auth instance', () => {
    const auth = { currentUser: null };
    const getAuth = jest.fn(() => auth);
    jest.doMock('firebase/auth', () => ({
      initializeAuth: jest.fn(() => {
        throw new Error('already initialized');
      }),
      getReactNativePersistence: jest.fn(() => 'persistence'),
      connectAuthEmulator: jest.fn(),
      getAuth
    }));
    jest.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
    jest.doMock('@react-native-async-storage/async-storage', () => ({
      __esModule: true,
      default: {}
    }));
    jest.doMock('../src/services/firebaseApp', () => ({
      getFirebaseApp: jest.fn(() => ({ name: 'app' }))
    }));

    const { getFirebaseAuth } = require('../src/services/firebaseAuthRuntime.native') as typeof import('../src/services/firebaseAuthRuntime.native');

    expect(getFirebaseAuth()).toBe(auth);
    expect(getAuth).toHaveBeenCalledTimes(1);
  });

  test('Firebase app reuses an existing instance', () => {
    const existingApp = { name: 'existing' };
    const getApp = jest.fn(() => existingApp);
    const initializeApp = jest.fn();
    jest.doMock('firebase/app', () => ({
      getApps: jest.fn(() => [existingApp]),
      getApp,
      initializeApp
    }));

    const { getFirebaseApp } = require('../src/services/firebaseApp') as typeof import('../src/services/firebaseApp');

    expect(getFirebaseApp()).toBe(existingApp);
    expect(getFirebaseApp()).toBe(existingApp);
    expect(getApp).toHaveBeenCalledTimes(1);
    expect(initializeApp).not.toHaveBeenCalled();
  });

  test('Firebase app initializes from public environment', () => {
    const initializedApp = { name: 'initialized' };
    const initializeApp = jest.fn(() => initializedApp);
    jest.doMock('firebase/app', () => ({
      getApps: jest.fn(() => []),
      getApp: jest.fn(),
      initializeApp
    }));
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'api-key';
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = 'demo.firebaseapp.com';
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'demo-moneyhub';
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID = 'app-id';

    const { getFirebaseApp } = require('../src/services/firebaseApp') as typeof import('../src/services/firebaseApp');

    expect(getFirebaseApp()).toBe(initializedApp);
    expect(initializeApp).toHaveBeenCalledWith({
      apiKey: 'api-key',
      authDomain: 'demo.firebaseapp.com',
      projectId: 'demo-moneyhub',
      appId: 'app-id'
    });
  });
});
