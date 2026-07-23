export type AppEventName =
  | 'login'
  | 'signup'
  | 'logout'
  | 'screen_view'
  | 'button_click'
  | 'error_occurred'
  | 'feature_used';

export type AppScreenName = 'login' | 'register' | 'dashboard';
type AppButtonId = 'login_submit' | 'registration_submit' | 'assistant_open';
type AppErrorCode =
  | 'auth_invalid_credentials'
  | 'auth_email_in_use'
  | 'auth_network_request_failed'
  | 'unknown';
type AppFeatureName = 'authentication' | 'dashboard' | 'financial_assistant';

export type AppEventParams = Readonly<{
  screen_name?: AppScreenName;
  button_id?: AppButtonId;
  error_code?: AppErrorCode;
  method?: 'email';
  feature_name?: AppFeatureName;
}>;

export type AppUserProperties = Readonly<{
  account_type?: 'personal' | 'business';
  onboarding_state?: 'not_started' | 'in_progress' | 'completed';
}>;

export interface AnalyticsAdapter {
  logEvent(name: AppEventName, params?: AppEventParams): Promise<void>;
  setCurrentScreen(
    screenName: AppScreenName,
    screenClass?: AppScreenName
  ): Promise<void>;
  setUserId(userId: string | null): Promise<void>;
  setUserProperties(properties: AppUserProperties): Promise<void>;
}

interface AnalyticsOperations<TAnalytics> {
  logEvent(
    analytics: TAnalytics,
    name: AppEventName,
    params?: AppEventParams
  ): void | Promise<void>;
  setCurrentScreen(
    analytics: TAnalytics,
    screenName: AppScreenName,
    screenClass?: AppScreenName
  ): void | Promise<void>;
  setUserId(analytics: TAnalytics, userId: string | null): void | Promise<void>;
  setUserProperties(
    analytics: TAnalytics,
    properties: AppUserProperties
  ): void | Promise<void>;
}

interface WebAnalyticsDependencies<TAnalytics>
  extends AnalyticsOperations<TAnalytics> {
  isSupported(): Promise<boolean>;
  initialize(): TAnalytics;
}

interface NativeAnalyticsModule {
  logEvent(name: AppEventName, params?: AppEventParams): Promise<void>;
  setCurrentScreen(
    screenName: AppScreenName,
    screenClass?: AppScreenName
  ): Promise<void>;
  setUserId(userId: string | null): Promise<void>;
  setUserProperties(properties: AppUserProperties): Promise<void>;
}

const safeValues = {
  screen_name: new Set(['login', 'register', 'dashboard']),
  button_id: new Set(['login_submit', 'registration_submit', 'assistant_open']),
  error_code: new Set([
    'auth_invalid_credentials',
    'auth_email_in_use',
    'auth_network_request_failed',
    'unknown'
  ]),
  method: new Set(['email']),
  feature_name: new Set(['authentication', 'dashboard', 'financial_assistant'])
} as const;

function sanitizeEventParams(params?: AppEventParams) {
  if (!params) return undefined;
  const safe: Record<string, string> = {};

  for (const key of Object.keys(safeValues) as (keyof typeof safeValues)[]) {
    const value = params[key];
    if (typeof value === 'string' && safeValues[key].has(value as never)) {
      safe[key] = value;
    }
  }

  return Object.keys(safe).length > 0 ? safe : undefined;
}

function sanitizeUserProperties(properties: AppUserProperties) {
  return {
    ...(properties.account_type === 'personal' ||
    properties.account_type === 'business'
      ? { account_type: properties.account_type }
      : {}),
    ...(properties.onboarding_state === 'not_started' ||
    properties.onboarding_state === 'in_progress' ||
    properties.onboarding_state === 'completed'
      ? { onboarding_state: properties.onboarding_state }
      : {})
  };
}

export function createNoopAnalyticsAdapter(): AnalyticsAdapter {
  return {
    async logEvent() {},
    async setCurrentScreen() {},
    async setUserId() {},
    async setUserProperties() {}
  };
}

function createResilientAdapter<TAnalytics>(
  loadAnalytics: () => Promise<TAnalytics | null>,
  operations: AnalyticsOperations<TAnalytics>
): AnalyticsAdapter {
  const safely = async (
    operation: (analytics: TAnalytics) => void | Promise<void>
  ) => {
    try {
      const analytics = await loadAnalytics();
      if (analytics) await operation(analytics);
    } catch {
      // Analytics is best-effort and must never block product workflows.
    }
  };

  return {
    logEvent: (name, params) =>
      safely((analytics) =>
        operations.logEvent(analytics, name, sanitizeEventParams(params))
      ),
    setCurrentScreen: (screenName, screenClass) =>
      safely((analytics) =>
        operations.setCurrentScreen(analytics, screenName, screenClass)
      ),
    setUserId: (userId) =>
      safely((analytics) => operations.setUserId(analytics, userId)),
    setUserProperties: (properties) =>
      safely((analytics) =>
        operations.setUserProperties(
          analytics,
          sanitizeUserProperties(properties)
        )
      )
  };
}

export function createWebAnalyticsAdapter<TAnalytics>(
  dependencies: WebAnalyticsDependencies<TAnalytics>
): AnalyticsAdapter {
  let analyticsPromise: Promise<TAnalytics | null> | undefined;
  const loadAnalytics = () => {
    analyticsPromise ??= dependencies
      .isSupported()
      .then((supported) => (supported ? dependencies.initialize() : null))
      .catch(() => null);
    return analyticsPromise;
  };

  return createResilientAdapter(loadAnalytics, dependencies);
}

export function createNativeAnalyticsAdapter(
  loadModule: () => Promise<NativeAnalyticsModule>
): AnalyticsAdapter {
  let modulePromise: Promise<NativeAnalyticsModule | null> | undefined;
  const loadAnalytics = () => {
    modulePromise ??= loadModule().catch(() => null);
    return modulePromise;
  };

  return createResilientAdapter(loadAnalytics, {
    logEvent: (analytics, name, params) => analytics.logEvent(name, params),
    setCurrentScreen: (analytics, screenName, screenClass) =>
      analytics.setCurrentScreen(screenName, screenClass),
    setUserId: (analytics, userId) => analytics.setUserId(userId),
    setUserProperties: (analytics, properties) =>
      analytics.setUserProperties(properties)
  });
}
