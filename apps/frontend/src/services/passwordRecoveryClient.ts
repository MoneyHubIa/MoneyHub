import { resolveRuntimeUrl } from './runtimeUrl';

export interface PasswordRecoveryClient {
  request(email: string): Promise<void>;
  verifyCode(oobCode: string): Promise<string>;
  confirm(oobCode: string, newPassword: string): Promise<void>;
}

type PasswordRecoveryDependencies = Readonly<{
  endpoint: string;
  fetchRequest(
    input: string,
    init: {
      method: 'POST';
      headers: { 'content-type': 'application/json' };
      body: string;
    }
  ): Promise<{ ok: boolean }>;
  verifyPasswordResetCode(oobCode: string): Promise<string>;
  confirmPasswordReset(oobCode: string, newPassword: string): Promise<void>;
}>;

export function createPasswordRecoveryClient(
  dependencies: PasswordRecoveryDependencies
): PasswordRecoveryClient {
  return {
    async request(email) {
      const response = await dependencies.fetchRequest(dependencies.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (!response.ok) {
        throw new Error('Password recovery request was not accepted.');
      }
    },
    verifyCode(oobCode) {
      return dependencies.verifyPasswordResetCode(oobCode);
    },
    confirm(oobCode, newPassword) {
      return dependencies.confirmPasswordReset(oobCode, newPassword);
    }
  };
}

export function resolvePasswordRecoveryEndpoint(
  appUrl: unknown,
  platform: string,
  isDevelopment = __DEV__
) {
  if (platform === 'web' && !isDevelopment) {
    return '/auth/password-recovery';
  }
  if (typeof appUrl !== 'string' || !appUrl) {
    throw new Error('APP_URL is required in the Expo configuration.');
  }

  return resolveRuntimeUrl(
    new URL('/auth/password-recovery', appUrl).toString(),
    platform
  );
}
