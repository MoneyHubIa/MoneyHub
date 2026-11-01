export type FirebaseClientConfig = Readonly<{
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
}>;

type PublicEnvironment = Readonly<Record<string, string | undefined>>;

export function readFirebaseConfig(
  environment: PublicEnvironment
): FirebaseClientConfig {
  for (const [name, value] of Object.entries(environment)) {
    if (name.startsWith('EXPO_PUBLIC_FIREBASE_') && value?.trim() === '[SENSITIVE]') {
      throw new Error(
        `${name} contains a Vercel redaction placeholder. Configure public Firebase variables as Config (not Secret/Sensitive) before building.`
      );
    }
  }

  const apiKey = environment.EXPO_PUBLIC_FIREBASE_API_KEY;
  const authDomain = environment.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = environment.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = environment.EXPO_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey?.trim() || !authDomain?.trim() || !projectId?.trim() || !appId?.trim()) {
    throw new Error('Firebase client configuration is incomplete.');
  }

  const storageBucket = environment.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId =
    environment.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const measurementId = environment.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID;

  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    ...(storageBucket ? { storageBucket } : {}),
    ...(messagingSenderId ? { messagingSenderId } : {}),
    ...(measurementId ? { measurementId } : {})
  };
}
