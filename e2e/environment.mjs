const localDatabaseUrl =
  'postgresql://moneyhub_e2e:moneyhub_e2e@127.0.0.1:55432/moneyhub_e2e?sslmode=disable';

const sensitiveKeys = [
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_PRIVATE_KEY_BASE64',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'LLM_API_KEY',
  'LLM_BASE_URL',
  'LLM_MODEL',
  'LLM_TIMEOUT_MS',
  'OPENAI_API_KEY'
];

export function createE2eEnvironment(parent = process.env) {
  const environment = {
    ...parent,
    APP_URL: 'http://127.0.0.1:3000',
    PORT: '3000',
    RATE_LIMIT_MAX: '10000',
    RATE_LIMIT_WINDOW_MS: '900000',
    DATABASE_URL: localDatabaseUrl,
    DIRECT_URL: localDatabaseUrl,
    FIREBASE_PROJECT_ID: 'demo-moneyhub',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    FIREBASE_WEB_API_KEY: 'demo-api-key',
    EXPO_PUBLIC_APP_URL: 'http://127.0.0.1:3000',
    EXPO_PUBLIC_FIREBASE_API_KEY: 'demo-api-key',
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-moneyhub.firebaseapp.com',
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo-moneyhub',
    EXPO_PUBLIC_FIREBASE_APP_ID: 'demo-app-id',
    EXPO_PUBLIC_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
    EXPO_NO_DOTENV: '1',
    LLM_PROVIDER: 'mock'
  };

  for (const key of sensitiveKeys) delete environment[key];
  return environment;
}
