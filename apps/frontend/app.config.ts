import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const rootEnvironmentFile = fileURLToPath(new URL('../../.env', import.meta.url));
if (process.env.EXPO_NO_DOTENV !== '1' && existsSync(rootEnvironmentFile)) {
  process.loadEnvFile(rootEnvironmentFile);
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new Error('APP_URL is required.');
  }
  if (appUrl.trim() === '[SENSITIVE]') {
    throw new Error('APP_URL contains a Vercel redaction placeholder. Configure this public URL as Config before building.');
  }
  // Expo evaluates this file before bundling, so reject redacted CLI values here.
  for (const [name, value] of Object.entries(process.env)) {
    if (name.startsWith('EXPO_PUBLIC_FIREBASE_') && value?.trim() === '[SENSITIVE]') {
      throw new Error(
        `${name} contains a Vercel redaction placeholder. Configure public Firebase variables as Config (not Secret/Sensitive) before building.`
      );
    }
  }
  for (const name of [
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_FIREBASE_APP_ID'
  ]) {
    if (!process.env[name]?.trim()) {
      throw new Error('Firebase client configuration is incomplete.');
    }
  }
  process.env.EXPO_PUBLIC_APP_URL = appUrl;
  const nativeE2e = process.env.E2E_NATIVE === '1';

  return {
    ...config,
    android: {
      ...config.android,
      ...(nativeE2e ? { package: 'com.moneyhub.e2e', googleServicesFile: './google-services.e2e.json' } : {})
    },
    ios: {
      ...config.ios,
      ...(nativeE2e ? { bundleIdentifier: 'com.moneyhub.e2e' } : {})
    },
    extra: {
      ...config.extra,
      appUrl
    }
  };
};
