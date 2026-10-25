import { createHash } from 'node:crypto';

export const DEMO_PROJECT_ID = 'demo-moneyhub';
export const DEMO_UID = 'moneyhub-demo-user';
export const DEMO_EMAIL = 'demo@moneyhub.local';
export const DEMO_PASSWORD = 'MoneyHubDemo123!';

export function demoId(name: string): string {
  const hex = createHash('sha256').update(`moneyhub-demo-v1:${name}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function assertDemoEnvironment(environment: NodeJS.ProcessEnv): void {
  let localDatabase = false;
  try {
    const url = new URL(environment.DATABASE_URL ?? '');
    localDatabase = ['postgresql:', 'postgres:'].includes(url.protocol)
      && ['db', '127.0.0.1', 'localhost'].includes(url.hostname)
      && ['/moneyhub', '/moneyhub_demo_test'].includes(url.pathname);
  } catch { /* Missing or invalid database URL is rejected below. */ }
  if (environment.FIREBASE_PROJECT_ID !== DEMO_PROJECT_ID
    || !/^(127\.0\.0\.1|localhost):9099$/.test(environment.FIREBASE_AUTH_EMULATOR_HOST ?? '')
    || !localDatabase) {
    throw new Error('Demo seed requires demo-moneyhub, a local Auth Emulator on port 9099 and a local moneyhub database.');
  }
}

export function demoDates(anchor: Date) {
  const day = (offset: number) => new Date(Date.UTC(
    anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate() + offset
  ));
  const month = (offset: number, date = 1) => new Date(Date.UTC(
    anchor.getUTCFullYear(), anchor.getUTCMonth() + offset, date, 12
  ));
  return { day, month };
}
