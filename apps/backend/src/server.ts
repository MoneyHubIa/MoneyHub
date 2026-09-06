import 'dotenv/config';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { createApp } from './core/app/app.js';
import { createFirebaseAuthRestClient } from './modules/auth/firebase-rest/firebase-auth-rest.js';
import { appLogger } from './core/http-logger/http-logger.js';
import { createPasswordRecoveryService } from './modules/auth/password-recovery/password-recovery.js';
import { loadRootEnvironment, loadRuntimeConfig } from './core/runtime-config/runtime-config.js';

loadRootEnvironment();
const { appUrl, firebaseWebApiKey } = loadRuntimeConfig();
const port = Number(process.env.PORT || 3000);
const firebaseAuthRest = createFirebaseAuthRestClient({
  apiKey: firebaseWebApiKey
});
const passwordRecovery = createPasswordRecoveryService({
  appUrl,
  firebaseAuthRest,
  audit: (event) => {
    if (event.status === 'firebase_error') appLogger.error(event);
    else appLogger.info(event);
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
