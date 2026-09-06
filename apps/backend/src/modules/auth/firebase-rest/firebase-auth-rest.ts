export type FirebaseAuthRestClient = {
  requestPasswordReset(input: {
    email: string;
    continueUrl: string;
    userIp: string;
  }): Promise<void>;
  verifyPasswordResetCode(oobCode: string): Promise<void>;
  confirmPasswordReset(oobCode: string, newPassword: string): Promise<void>;
};

export class FirebaseAuthRestError extends Error {
  constructor(readonly providerCode: string) {
    super('Firebase Auth REST request failed.');
  }
}

type FirebaseAuthRestClientOptions = Readonly<{
  apiKey: string;
  timeoutMs?: number;
  fetchRequest?: typeof fetch;
}>;

const FIREBASE_AUTH_BASE_URL = 'https://identitytoolkit.googleapis.com/v1';
const PROVIDER_CODE_PATTERN = /^[A-Z0-9_:/-]{1,100}$/i;

function endpoint(path: string, apiKey: string) {
  return `${FIREBASE_AUTH_BASE_URL}/${path}?key=${apiKey}`;
}

async function providerCodeFromResponse(response: Response) {
  try {
    const payload = await response.json();
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'object' &&
      payload.error !== null &&
      'message' in payload.error
        ? payload.error.message
        : undefined;

    const code = typeof message === 'string'
      ? message.split(' : ', 1)[0]
      : undefined;

    return typeof code === 'string' && PROVIDER_CODE_PATTERN.test(code)
      ? code
      : 'provider/unknown';
  } catch {
    return 'provider/unknown';
  }
}

export function createFirebaseAuthRestClient(
  options: FirebaseAuthRestClientOptions
): FirebaseAuthRestClient {
  const fetchRequest = options.fetchRequest ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;

  async function post(path: string, body: Record<string, string | boolean>) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchRequest(endpoint(path, options.apiKey), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (response.ok) {
        return;
      }

      throw new FirebaseAuthRestError(await providerCodeFromResponse(response));
    } catch (error) {
      if (controller.signal.aborted) {
        throw new FirebaseAuthRestError('provider/timeout');
      }

      if (error instanceof FirebaseAuthRestError) {
        throw error;
      }

      throw new FirebaseAuthRestError('provider/unknown');
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async requestPasswordReset(input) {
      const payload: Record<string, string | boolean> = {
        requestType: 'PASSWORD_RESET',
        email: input.email,
        canHandleCodeInApp: false,
        userIp: input.userIp
      };
      if (input.continueUrl) {
        payload.continueUrl = input.continueUrl;
      }

      try {
        await post('accounts:sendOobCode', payload);
      } catch (error) {
        if (
          error instanceof FirebaseAuthRestError &&
          error.providerCode === 'UNAUTHORIZED_DOMAIN' &&
          input.continueUrl
        ) {
          await post('accounts:sendOobCode', {
            requestType: 'PASSWORD_RESET',
            email: input.email,
            canHandleCodeInApp: false,
            userIp: input.userIp
          });
          return;
        }
        throw error;
      }
    },
    verifyPasswordResetCode(oobCode) {
      return post('accounts:resetPassword', { oobCode });
    },
    confirmPasswordReset(oobCode, newPassword) {
      return post('accounts:resetPassword', { oobCode, newPassword });
    }
  };
}
