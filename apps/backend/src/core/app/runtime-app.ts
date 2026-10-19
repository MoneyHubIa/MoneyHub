import type { Express } from 'express';
import { createApp } from './app.js';
import { createFirebaseAuthRestClient } from '../../modules/auth/firebase-rest/firebase-auth-rest.js';
import { appLogger } from '../http-logger/http-logger.js';
import { createPasswordRecoveryService } from '../../modules/auth/password-recovery/password-recovery.js';
import { loadRuntimeConfig } from '../runtime-config/runtime-config.js';

type RuntimeAppOptions = {
  environment?: NodeJS.ProcessEnv;
  frontendDistDir?: string;
};

export async function createRuntimeApp(
  options: RuntimeAppOptions = {}
): Promise<Express> {
  const environment = options.environment ?? process.env;
  const { appUrl, firebaseWebApiKey } = loadRuntimeConfig(environment);
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

  return createApp({
    appUrl,
    passwordRecovery,
    ...(options.frontendDistDir ? { frontendDistDir: options.frontendDistDir } : {}),
    ...(environment.NODE_ENV ? { nodeEnvironment: environment.NODE_ENV } : {})
  });
}
