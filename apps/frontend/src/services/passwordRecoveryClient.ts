import { resolveRuntimeUrl } from './runtimeUrl';

export interface PasswordRecoveryClient {
  request(email: string): Promise<void>;
  verifyCode(oobCode: string): Promise<void>;
  confirm(oobCode: string, newPassword: string): Promise<void>;
}

type PasswordRecoveryFetchRequestInit = {
  method: 'POST';
  headers: { 'content-type': 'application/json' };
  body: string;
};

type PasswordRecoveryFetchResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

type PasswordRecoveryDependencies = Readonly<{
  endpoint: string;
  fetchRequest(input: string, init: PasswordRecoveryFetchRequestInit): Promise<PasswordRecoveryFetchResponse>;
}>;

const JSON_HEADERS = { 'content-type': 'application/json' } as const;

function passwordRecoveryError(
  code:
    | 'auth/internal-error'
    | 'auth/invalid-action-code'
    | 'auth/network-request-failed'
    | 'auth/recovery-unavailable'
    | 'auth/too-many-requests'
    | 'auth/weak-password',
  message: string
) {
  return Object.assign(new Error(message), { code });
}

function recoveryRequest(
  body: Record<string, string>
): PasswordRecoveryFetchRequestInit {
  return {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body)
  };
}

async function recoveryErrorCode(response: PasswordRecoveryFetchResponse) {
  try {
    const body = await response.json();
    if (typeof body !== 'object' || body === null || !('error' in body)) {
      return null;
    }

    const error = body.error;
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return null;
    }

    return typeof error.code === 'string' ? error.code : null;
  } catch {
    return null;
  }
}

async function ensureSuccess(
  response: PasswordRecoveryFetchResponse,
  failureMessage: string
) {
  if (response.ok) {
    return;
  }

  const errorCode = await recoveryErrorCode(response);
  if (errorCode === 'WEAK_PASSWORD') {
    throw passwordRecoveryError(
      'auth/weak-password',
      'Password recovery confirmation failed.'
    );
  }
  if (errorCode === 'INVALID_OR_EXPIRED_ACTION_CODE') {
    throw passwordRecoveryError(
      'auth/invalid-action-code',
      failureMessage
    );
  }
  if (errorCode === 'RATE_LIMITED') {
    throw passwordRecoveryError('auth/too-many-requests', failureMessage);
  }
  if (errorCode === 'RECOVERY_UNAVAILABLE') {
    throw passwordRecoveryError('auth/recovery-unavailable', failureMessage);
  }

  throw passwordRecoveryError('auth/internal-error', failureMessage);
}

async function postRecoveryRequest(
  dependencies: PasswordRecoveryDependencies,
  endpoint: string,
  body: Record<string, string>,
  failureMessage: string
) {
  let response: PasswordRecoveryFetchResponse;
  try {
    response = await dependencies.fetchRequest(endpoint, recoveryRequest(body));
  } catch {
    throw passwordRecoveryError('auth/network-request-failed', failureMessage);
  }

  await ensureSuccess(response, failureMessage);
}

export function createPasswordRecoveryClient(
  dependencies: PasswordRecoveryDependencies
): PasswordRecoveryClient {
  return {
    async request(email) {
      await postRecoveryRequest(
        dependencies,
        dependencies.endpoint,
        { email },
        'Password recovery request failed.'
      );
    },
    async verifyCode(oobCode) {
      await postRecoveryRequest(
        dependencies,
        `${dependencies.endpoint}/verify`,
        { oobCode },
        'Password recovery verification failed.'
      );
    },
    async confirm(oobCode, newPassword) {
      await postRecoveryRequest(
        dependencies,
        `${dependencies.endpoint}/confirm`,
        { oobCode, newPassword },
        'Password recovery confirmation failed.'
      );
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
