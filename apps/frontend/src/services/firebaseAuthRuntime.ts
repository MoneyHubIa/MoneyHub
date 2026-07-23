import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { getFirebaseApp } from './firebaseApp';
import { resolveRuntimeUrl } from './runtimeUrl';

let auth: Auth | undefined;
let emulatorConnected = false;

export function getFirebaseAuth() {
  auth ??= getAuth(getFirebaseApp());
  const emulatorUrl = process.env.EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL;
  if (emulatorUrl && !emulatorConnected) {
    connectAuthEmulator(auth, resolveRuntimeUrl(emulatorUrl, 'web'), {
      disableWarnings: true
    });
    emulatorConnected = true;
  }
  return auth;
}
