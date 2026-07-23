import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  connectAuthEmulator,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
  type Auth
} from 'firebase/auth';
import { getFirebaseApp } from './firebaseApp';
import { resolveRuntimeUrl } from './runtimeUrl';

let auth: Auth | undefined;
let emulatorConnected = false;

export function getFirebaseAuth() {
  if (!auth) {
    const app = getFirebaseApp();
    try {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
      });
    } catch {
      auth = getAuth(app);
    }
  }

  const emulatorUrl = process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL;
  if (emulatorUrl && !emulatorConnected) {
    connectAuthEmulator(auth, resolveRuntimeUrl(emulatorUrl, Platform.OS), {
      disableWarnings: true
    });
    emulatorConnected = true;
  }
  return auth;
}
