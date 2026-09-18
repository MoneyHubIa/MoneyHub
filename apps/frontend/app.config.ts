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
  process.env.EXPO_PUBLIC_APP_URL = appUrl;
  const nativeE2e = process.env.E2E_NATIVE === '1';

  return {
    ...config,
    android: {
      ...config.android,
      ...(nativeE2e ? { package: 'com.moneyhub.e2e' } : {})
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
