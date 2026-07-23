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
});
