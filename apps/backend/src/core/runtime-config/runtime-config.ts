import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnvironmentFile } from 'dotenv';

export type RuntimeConfig = Readonly<{
  appUrl: URL;
  firebaseWebApiKey: string;
  trustProxyHops: number;
  databasePoolMax: number;
}>;

function integerSetting(environment: NodeJS.ProcessEnv, name: string, fallback: number, minimum: number): number {
  const raw = environment[name];
  const value = raw === undefined ? fallback : /^\d+$/.test(raw.trim()) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer greater than or equal to ${minimum}.`);
  }
  return value;
}

export function loadDatabasePoolMax(environment: NodeJS.ProcessEnv = process.env): number {
  return integerSetting(environment, 'DATABASE_POOL_MAX', 2, 1);
}

export function loadTrustProxyHops(environment: NodeJS.ProcessEnv = process.env): number {
  return integerSetting(environment, 'TRUST_PROXY_HOPS', environment.VERCEL === '1' ? 1 : 0, 0);
}

export function loadRootEnvironment(workingDirectory = process.cwd()): void {
  const candidates = [
    resolve(workingDirectory, '../../.env'),
    resolve(workingDirectory, '.env')
  ];
  const rootEnvironmentFile = candidates.find((candidate) => existsSync(candidate));

  if (rootEnvironmentFile) {
    loadEnvironmentFile({ path: rootEnvironmentFile, override: true });
  }
}

export function loadRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env
): RuntimeConfig {
  if (!environment.APP_URL) {
    throw new Error('APP_URL is required.');
  }
  if (!environment.FIREBASE_WEB_API_KEY?.trim()) {
    throw new Error('FIREBASE_WEB_API_KEY is required.');
  }

  return {
    appUrl: new URL(environment.APP_URL),
    firebaseWebApiKey: environment.FIREBASE_WEB_API_KEY.trim(),
    trustProxyHops: loadTrustProxyHops(environment),
    databasePoolMax: loadDatabasePoolMax(environment)
  };
}
