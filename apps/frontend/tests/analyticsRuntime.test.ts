/* eslint-disable @typescript-eslint/no-require-imports */
describe('analytics runtime adapters', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('web runtime forwards screen views through Firebase Analytics', async () => {
    const instance = { platform: 'web' };
    const logEvent = jest.fn();
    jest.doMock('firebase/analytics', () => ({
      getAnalytics: jest.fn(() => instance),
      isSupported: jest.fn(async () => true),
      logEvent,
      setUserId: jest.fn(),
      setUserProperties: jest.fn()
    }));
    jest.doMock('../src/services/firebaseApp', () => ({
      getFirebaseApp: jest.fn(() => ({ name: 'firebase-app' }))
    }));

    const { analytics } = require('../src/services/analyticsRuntime.web') as typeof import('../src/services/analyticsRuntime.web');
    await analytics.setCurrentScreen('dashboard');

    expect(logEvent).toHaveBeenCalledWith(instance, 'screen_view', {
      firebase_screen: 'dashboard',
      firebase_screen_class: 'dashboard'
    });
  });

  test('default runtime remains a safe no-op', async () => {
    const { analytics } = require('../src/services/analyticsRuntime') as typeof import('../src/services/analyticsRuntime');

    await expect(analytics.logEvent('login')).resolves.toBeUndefined();
    await expect(analytics.setUserId(null)).resolves.toBeUndefined();
  });

  test('native runtime forwards all operations to React Native Firebase', async () => {
    const instance = {
      logEvent: jest.fn(async () => undefined),
      logScreenView: jest.fn(async () => undefined),
      setUserId: jest.fn(async () => undefined),
      setUserProperties: jest.fn(async () => undefined)
    };
    const { createNativeAnalyticsRuntime } = require('../src/services/analyticsRuntime.native') as typeof import('../src/services/analyticsRuntime.native');
    const analytics = createNativeAnalyticsRuntime(async () => instance);
    await analytics.logEvent('login', { method: 'email' });
    await analytics.setCurrentScreen('dashboard');
    await analytics.setUserId('firebase-user');
    await analytics.setUserProperties({ account_type: 'personal' });

    expect(instance.logEvent).toHaveBeenCalledWith('login', { method: 'email' });
    expect(instance.logScreenView).toHaveBeenCalledWith({
      screen_name: 'dashboard',
      screen_class: 'dashboard'
    });
    expect(instance.setUserId).toHaveBeenCalledWith('firebase-user');
    expect(instance.setUserProperties).toHaveBeenCalledWith({
      account_type: 'personal'
    });
  });
});
