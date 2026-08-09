import { createHash } from 'node:crypto';

export type PasswordRecoveryService = {
  request(input: { email: string; requestId: string }): Promise<void>;
};

export type PasswordRecoveryAuditEvent = Readonly<{
  event: 'password_recovery_requested';
  requestId: string;
  emailHash: string;
  status: 'sent' | 'unknown_user' | 'firebase_error' | 'email_error';
  providerCode?: string;
}>;

type PasswordRecoveryDependencies = Readonly<{
  appUrl: URL;
  fromEmail: string;
  providerTimeoutMs?: number | undefined;
  generatePasswordResetLink(
    email: string,
    settings: { url: string; handleCodeInApp: boolean }
  ): Promise<string>;
  sendEmail(
    message: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      text: string;
    },
    options: { idempotencyKey: string }
  ): Promise<void>;
  audit(event: PasswordRecoveryAuditEvent): void;
}>;

function withProviderTimeout<T>(operation: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(Object.assign(new Error('Password recovery provider timed out.'), {
        code: 'provider/timeout'
      }));
    }, timeoutMs);

    operation.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function normalizedEmail(email: string) {
  return email.trim().toLowerCase();
}

function emailHash(email: string) {
  return createHash('sha256').update(email).digest('hex');
}

function providerCode(error: unknown) {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }

  const code = error.code;
  return typeof code === 'string' && /^[a-z0-9_/-]{1,100}$/i.test(code)
    ? code
    : undefined;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character] ?? character);
}

function recoveryEmail(link: string) {
  const safeLink = escapeHtml(link);
  return {
    subject: 'Redefina sua senha do MoneyHub',
    text: [
      'Recebemos uma solicitação para redefinir sua senha do MoneyHub.',
      '',
      `Redefina sua senha: ${link}`,
      '',
      'Se você não solicitou esta alteração, ignore este e-mail.'
    ].join('\n'),
    html: [
      '<h1>Redefina sua senha do MoneyHub</h1>',
      '<p>Recebemos uma solicitação para redefinir sua senha.</p>',
      `<p><a href="${safeLink}">Redefinir senha</a></p>`,
      '<p>Se você não solicitou esta alteração, ignore este e-mail.</p>'
    ].join('')
  };
}

export function createPasswordRecoveryService(
  dependencies: PasswordRecoveryDependencies
): PasswordRecoveryService {
  const providerTimeoutMs = dependencies.providerTimeoutMs ?? 10_000;
  const audit = (event: PasswordRecoveryAuditEvent) => {
    try {
      dependencies.audit(event);
    } catch {
      // Audit transport failures must not alter the public recovery behavior.
    }
  };

  return {
    async request({ email, requestId }) {
      const normalized = normalizedEmail(email);
      const baseAuditEvent = {
        event: 'password_recovery_requested' as const,
        requestId,
        emailHash: emailHash(normalized)
      };
      let link: string;

      try {
        link = await withProviderTimeout(
          dependencies.generatePasswordResetLink(normalized, {
            url: new URL('/login', dependencies.appUrl).toString(),
            handleCodeInApp: false
          }),
          providerTimeoutMs
        );
      } catch (error) {
        const code = providerCode(error);
        audit({
          ...baseAuditEvent,
          status: code === 'auth/user-not-found' ? 'unknown_user' : 'firebase_error',
          ...(code ? { providerCode: code } : {})
        });
        return;
      }

      const message = recoveryEmail(link);
      try {
        await withProviderTimeout(
          dependencies.sendEmail(
            {
              from: dependencies.fromEmail,
              to: [normalized],
              ...message
            },
            { idempotencyKey: `password-recovery/${requestId}` }
          ),
          providerTimeoutMs
        );
      } catch (error) {
        const code = providerCode(error);
        audit({
          ...baseAuditEvent,
          status: 'email_error',
          ...(code ? { providerCode: code } : {})
        });
        return;
      }

      audit({ ...baseAuditEvent, status: 'sent' });
    }
  };
}
