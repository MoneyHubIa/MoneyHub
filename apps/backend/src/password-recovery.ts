import { createHash } from 'node:crypto';
import {
  FirebaseAuthRestError,
  type FirebaseAuthRestClient
} from './firebase-auth-rest.js';

export type PasswordRecoveryService = {
  request(input: {
    email: string;
    requestId: string;
    userIp: string;
  }): Promise<void>;
  verify(input: { oobCode: string; requestId: string }): Promise<void>;
  confirm(input: {
    oobCode: string;
    newPassword: string;
    requestId: string;
  }): Promise<void>;
};

export type PasswordRecoveryPublicCode =
  | 'INVALID_OR_EXPIRED_ACTION_CODE'
  | 'WEAK_PASSWORD'
  | 'RECOVERY_UNAVAILABLE';

export class PasswordRecoveryPublicError extends Error {
  constructor(readonly code: PasswordRecoveryPublicCode) {
    super('Password recovery operation failed.');
  }
}

export type PasswordRecoveryAuditEvent = Readonly<{
  event:
    | 'password_recovery_requested'
    | 'password_recovery_code_verified'
    | 'password_recovery_confirmed';
  requestId: string;
  status:
    | 'requested'
    | 'unknown_user'
    | 'verified'
    | 'confirmed'
    | 'firebase_error'
    | 'invalid_code'
    | 'weak_password';
  emailHash?: string;
  providerCode?: string;
}>;

type PasswordRecoveryDependencies = Readonly<{
  appUrl: URL;
  firebaseAuthRest: FirebaseAuthRestClient;
  audit(event: PasswordRecoveryAuditEvent): void;
}>;

const SAFE_PROVIDER_CODES = new Set([
  'EMAIL_NOT_FOUND',
  'INVALID_OOB_CODE',
  'EXPIRED_OOB_CODE',
  'WEAK_PASSWORD',
  'PASSWORD_DOES_NOT_MEET_REQUIREMENTS',
  'provider/timeout',
  'provider/unknown'
]);

function normalizedEmail(email: string) {
  return email.trim().toLowerCase();
}

function emailHash(email: string) {
  return createHash('sha256').update(email).digest('hex');
}

function safeProviderCode(rawCode: unknown) {
  return typeof rawCode === 'string' && SAFE_PROVIDER_CODES.has(rawCode)
    ? rawCode
    : undefined;
}

function providerCode(error: unknown) {
  if (error instanceof FirebaseAuthRestError) {
    return safeProviderCode(error.providerCode);
  }

  if (typeof error !== 'object' || error === null || !('providerCode' in error)) {
    return undefined;
  }

  return safeProviderCode(error.providerCode);
}

function safeAudit(
  auditTransport: PasswordRecoveryDependencies['audit'],
  event: PasswordRecoveryAuditEvent
) {
  try {
    auditTransport(event);
  } catch {
    // Audit transport failures must not alter the public recovery behavior.
  }
}

function invalidOrExpiredCode(providerCode: string | undefined) {
  return providerCode === 'INVALID_OOB_CODE' || providerCode === 'EXPIRED_OOB_CODE';
}

function weakPasswordCode(providerCode: string | undefined) {
  return (
    providerCode === 'WEAK_PASSWORD' ||
    providerCode === 'PASSWORD_DOES_NOT_MEET_REQUIREMENTS'
  );
}

function withProviderCode(
  event: Omit<PasswordRecoveryAuditEvent, 'providerCode'>,
  code: string | undefined
): PasswordRecoveryAuditEvent {
  return code ? { ...event, providerCode: code } : event;
}

export function createPasswordRecoveryService(
  dependencies: PasswordRecoveryDependencies
): PasswordRecoveryService {
  return {
    async request({ email, requestId, userIp }) {
      const normalized = normalizedEmail(email);
      const baseEvent = {
        event: 'password_recovery_requested' as const,
        requestId,
        emailHash: emailHash(normalized)
      };

      try {
        await dependencies.firebaseAuthRest.requestPasswordReset({
          email: normalized,
          continueUrl: new URL('/login', dependencies.appUrl).toString(),
          userIp
        });
        safeAudit(dependencies.audit, {
          ...baseEvent,
          status: 'requested'
        });
      } catch (error) {
        const code = providerCode(error);
        safeAudit(
          dependencies.audit,
          withProviderCode(
            {
              ...baseEvent,
              status: code === 'EMAIL_NOT_FOUND' ? 'unknown_user' : 'firebase_error'
            },
            code
          )
        );
      }
    },

    async verify({ oobCode, requestId }) {
      try {
        await dependencies.firebaseAuthRest.verifyPasswordResetCode(oobCode);
        safeAudit(dependencies.audit, {
          event: 'password_recovery_code_verified',
          requestId,
          status: 'verified'
        });
      } catch (error) {
        const code = providerCode(error);
        const publicCode = invalidOrExpiredCode(code)
          ? 'INVALID_OR_EXPIRED_ACTION_CODE'
          : 'RECOVERY_UNAVAILABLE';
        safeAudit(
          dependencies.audit,
          withProviderCode(
            {
              event: 'password_recovery_code_verified',
              requestId,
              status: invalidOrExpiredCode(code) ? 'invalid_code' : 'firebase_error'
            },
            code
          )
        );
        throw new PasswordRecoveryPublicError(publicCode);
      }
    },

    async confirm({ oobCode, newPassword, requestId }) {
      try {
        await dependencies.firebaseAuthRest.confirmPasswordReset(
          oobCode,
          newPassword
        );
        safeAudit(dependencies.audit, {
          event: 'password_recovery_confirmed',
          requestId,
          status: 'confirmed'
        });
      } catch (error) {
        const code = providerCode(error);
        const publicCode = invalidOrExpiredCode(code)
          ? 'INVALID_OR_EXPIRED_ACTION_CODE'
          : weakPasswordCode(code)
            ? 'WEAK_PASSWORD'
            : 'RECOVERY_UNAVAILABLE';
        const status = invalidOrExpiredCode(code)
          ? 'invalid_code'
          : weakPasswordCode(code)
            ? 'weak_password'
            : 'firebase_error';

        safeAudit(
          dependencies.audit,
          withProviderCode(
            {
              event: 'password_recovery_confirmed',
              requestId,
              status
            },
            code
          )
        );
        throw new PasswordRecoveryPublicError(publicCode);
      }
    }
  };
}
