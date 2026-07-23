import {
  getAnalytics,
  isSupported,
  logEvent,
  setUserId,
  setUserProperties
} from 'firebase/analytics';
import { createWebAnalyticsAdapter } from './analytics';
import { getFirebaseApp } from './firebaseApp';

export const analytics = createWebAnalyticsAdapter({
  isSupported,
  initialize: () => getAnalytics(getFirebaseApp()),
  logEvent,
  setCurrentScreen: (instance, screenName, screenClass) =>
    logEvent(instance, 'screen_view', {
      firebase_screen: screenName,
      firebase_screen_class: screenClass ?? screenName
    }),
  setUserId,
  setUserProperties
});
