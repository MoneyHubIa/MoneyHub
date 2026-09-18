import {
  createNativeAnalyticsAdapter,
  createNoopAnalyticsAdapter,
  createWebAnalyticsAdapter
} from '../src/services/analytics';

describe('analytics adapters', () => {
  test('the no-op adapter never interrupts a workflow', async () => {
    const analytics = createNoopAnalyticsAdapter();

    await expect(analytics.logEvent('screen_view', {
      screen_name: 'dashboard'
    })).resolves.toBeUndefined();
    await expect(analytics.setCurrentScreen('dashboard')).resolves.toBeUndefined();
    await expect(analytics.setUserId(null)).resolves.toBeUndefined();
    await expect(analytics.setUserProperties({ account_type: 'personal' }))
      .resolves.toBeUndefined();
  });

  test('the web adapter logs an allowed event when supported', async () => {
    const logEvent = jest.fn();
    const analytics = createWebAnalyticsAdapter({
      isSupported: async () => true,
      initialize: () => ({ platform: 'web' }),
      logEvent,
      setCurrentScreen: jest.fn(),
      setUserId: jest.fn(),
      setUserProperties: jest.fn()
    });

    await analytics.logEvent('login', { method: 'email' });

    expect(logEvent).toHaveBeenCalledWith(
      { platform: 'web' },
      'login',
      { method: 'email' }
    );
  });

  test('the web adapter falls back when analytics is unsupported', async () => {
    const logEvent = jest.fn();
    const analytics = createWebAnalyticsAdapter({
      isSupported: async () => false,
      initialize: () => ({ platform: 'web' }),
      logEvent,
      setCurrentScreen: jest.fn(),
      setUserId: jest.fn(),
      setUserProperties: jest.fn()
    });

    await expect(analytics.logEvent('signup', { method: 'email' }))
      .resolves.toBeUndefined();
    expect(logEvent).not.toHaveBeenCalled();
  });

  test('the web adapter discards fields outside the safe analytics dictionary', async () => {
    const logEvent = jest.fn();
    const setUserProperties = jest.fn();
    const analytics = createWebAnalyticsAdapter({
      isSupported: async () => true,
      initialize: () => ({ platform: 'web' }),
      logEvent,
      setCurrentScreen: jest.fn(),
      setUserId: jest.fn(),
      setUserProperties
    });

    await analytics.logEvent('error_occurred', {
      error_message: 'person@example.com has balance 1000'
    } as never);
    await analytics.setUserProperties({
      email: 'person@example.com'
    } as never);

    expect(logEvent).toHaveBeenCalledWith(
      { platform: 'web' },
      'error_occurred',
      undefined
    );
    expect(setUserProperties).toHaveBeenCalledWith({ platform: 'web' }, {});
  });

  test('the native adapter absorbs SDK loading failures', async () => {
    const analytics = createNativeAnalyticsAdapter(async () => {
      throw new Error('native analytics is not configured');
    });

    await expect(analytics.setCurrentScreen('login')).resolves.toBeUndefined();
  });

  test('the web adapter initializes once for concurrent operations', async () => {
    const initialize = jest.fn(() => ({ platform: 'web' }));
    const isSupported = jest.fn(async () => true);
    const logEvent = jest.fn();
    const setUserId = jest.fn();
    const analytics = createWebAnalyticsAdapter({
      isSupported,
      initialize,
      logEvent,
      setCurrentScreen: jest.fn(),
      setUserId,
      setUserProperties: jest.fn()
    });

    await Promise.all([
      analytics.logEvent('login', { method: 'email' }),
      analytics.setUserId(null)
    ]);

    expect(isSupported).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith(
      { platform: 'web' },
      'login',
      { method: 'email' }
    );
    expect(setUserId).toHaveBeenCalledWith({ platform: 'web' }, null);
  });

  test('the web adapter absorbs support and operation failures', async () => {
    const unavailable = createWebAnalyticsAdapter({
      isSupported: async () => {
        throw new Error('support check failed');
      },
      initialize: () => ({ platform: 'web' }),
      logEvent: jest.fn(),
      setCurrentScreen: jest.fn(),
      setUserId: jest.fn(),
      setUserProperties: jest.fn()
    });
    const failingOperation = createWebAnalyticsAdapter({
      isSupported: async () => true,
      initialize: () => ({ platform: 'web' }),
      logEvent: async () => {
        throw new Error('provider failed');
      },
      setCurrentScreen: jest.fn(),
      setUserId: jest.fn(),
      setUserProperties: jest.fn()
    });

    await expect(unavailable.logEvent('login')).resolves.toBeUndefined();
    await expect(failingOperation.logEvent('login')).resolves.toBeUndefined();
  });

  test('the native adapter loads once and forwards all operations', async () => {
    const module = {
      logEvent: jest.fn(async () => undefined),
      setCurrentScreen: jest.fn(async () => undefined),
      setUserId: jest.fn(async () => undefined),
      setUserProperties: jest.fn(async () => undefined)
    };
    const loadModule = jest.fn(async () => module);
    const analytics = createNativeAnalyticsAdapter(loadModule);

    await Promise.all([
      analytics.logEvent('feature_used', { feature_name: 'dashboard' }),
      analytics.setCurrentScreen('dashboard'),
      analytics.setUserId('firebase-user-1'),
      analytics.setUserProperties({ account_type: 'personal' })
    ]);

    expect(loadModule).toHaveBeenCalledTimes(1);
    expect(module.logEvent).toHaveBeenCalledWith('feature_used', {
      feature_name: 'dashboard'
    });
    expect(module.setCurrentScreen).toHaveBeenCalledWith('dashboard', undefined);
    expect(module.setUserId).toHaveBeenCalledWith('firebase-user-1');
    expect(module.setUserProperties).toHaveBeenCalledWith({
      account_type: 'personal'
    });
  });

  test('the native adapter absorbs rejected SDK operations', async () => {
    const analytics = createNativeAnalyticsAdapter(async () => ({
      logEvent: async () => {
        throw new Error('native provider failed');
      },
      setCurrentScreen: async () => undefined,
      setUserId: async () => undefined,
      setUserProperties: async () => undefined
    }));

    await expect(analytics.logEvent('login')).resolves.toBeUndefined();
  });
});
