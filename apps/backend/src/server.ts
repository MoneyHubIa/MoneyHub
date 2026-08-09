import 'dotenv/config';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { Resend } from 'resend';
import { createApp } from './app.js';
import { firebaseAuth } from './auth.js';
import { appLogger } from './http-logger.js';
import { createPasswordRecoveryService } from './password-recovery.js';
import { loadRootEnvironment, loadRuntimeConfig } from './runtime-config.js';

loadRootEnvironment();
const { appUrl, resendApiKey, resendFromEmail } = loadRuntimeConfig();
const port = Number(process.env.PORT || 3000);
const resend = new Resend(resendApiKey);
const adminAuth = firebaseAuth();
const passwordRecovery = createPasswordRecoveryService({
  appUrl,
  fromEmail: resendFromEmail,
  generatePasswordResetLink: (email, settings) =>
    adminAuth.generatePasswordResetLink(email, settings),
  sendEmail: async (message, options) => {
    const result = await resend.emails.send(message, options);
    if (result.error) {
      throw Object.assign(
        new Error('Resend rejected a password recovery email.'),
        { code: result.error.name }
      );
    }
  },
  audit: (event) => {
    if (event.status === 'firebase_error' || event.status === 'email_error') {
      appLogger.error(event);
      return;
    }
    appLogger.info(event);
  }
});
const app = await createApp({
  appUrl,
  passwordRecovery,
  frontendDistDir: resolve(process.cwd(), '../frontend/dist')
});
const server = createServer(app);

server.listen(port, () => {
  console.log(`MoneyHub backend listening on port ${port}`);
});

async function shutdown(): Promise<void> {
  server.close(async () => {
    await app.locals.stop?.();
    process.exit(0);
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
