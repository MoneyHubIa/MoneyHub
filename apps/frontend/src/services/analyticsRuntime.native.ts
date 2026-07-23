import { createNativeAnalyticsAdapter } from './analytics';

export const analytics = createNativeAnalyticsAdapter(async () => {
  const { default: getAnalytics } = await import(
    '@react-native-firebase/analytics'
  );
  const instance = getAnalytics();
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
