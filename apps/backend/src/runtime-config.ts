import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnvironmentFile } from 'dotenv';

export type RuntimeConfig = Readonly<{
  appUrl: URL;
}>;

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

  return { appUrl: new URL(environment.APP_URL) };
}
