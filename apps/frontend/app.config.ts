import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ConfigContext, ExpoConfig } from 'expo/config';

const rootEnvironmentFile = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(rootEnvironmentFile)) {
  process.loadEnvFile(rootEnvironmentFile);
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new Error('APP_URL is required.');
  }
  process.env.EXPO_PUBLIC_APP_URL = appUrl;

  return {
    ...config,
    extra: {
      ...config.extra,
      appUrl
    }
  };
};
