import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnvironmentFile } from 'dotenv';

export type RuntimeConfig = Readonly<{
  appUrl: URL;
  resendApiKey: string;
  resendFromEmail: string;
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
  if (!environment.RESEND_API_KEY?.trim()) {
    throw new Error('RESEND_API_KEY is required.');
  }
  if (!environment.RESEND_FROM_EMAIL?.trim()) {
    throw new Error('RESEND_FROM_EMAIL is required.');
  }

  return {
    appUrl: new URL(environment.APP_URL),
    resendApiKey: environment.RESEND_API_KEY.trim(),
    resendFromEmail: environment.RESEND_FROM_EMAIL.trim()
  };
}
