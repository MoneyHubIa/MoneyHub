import { createNativeAnalyticsAdapter } from './analytics';

type NativeAnalyticsInstance = {
  logEvent: (name: string, params?: Record<string, unknown>) => Promise<void>;
  logScreenView: (params: {
    screen_name: string;
    screen_class: string;
  }) => Promise<void>;
  setUserId: (userId: string | null) => Promise<void>;
  setUserProperties: (properties: Record<string, string | null>) => Promise<void>;
};

async function loadNativeAnalytics(): Promise<NativeAnalyticsInstance> {
  const { default: getAnalytics } = await import('@react-native-firebase/analytics');
  return getAnalytics();
}

export function createNativeAnalyticsRuntime(
  loadInstance: () => Promise<NativeAnalyticsInstance> = loadNativeAnalytics
) {
  return createNativeAnalyticsAdapter(async () => {
    const instance = await loadInstance();
    return {
      logEvent: (name, params) => instance.logEvent(name, params),
      setCurrentScreen: (screenName, screenClass) =>
        instance.logScreenView({
          screen_name: screenName,
          screen_class: screenClass ?? screenName
        }),
      setUserId: (userId) => instance.setUserId(userId),
      setUserProperties: (properties) =>
        instance.setUserProperties(properties)
    };
  });
}

export const analytics = createNativeAnalyticsRuntime();
