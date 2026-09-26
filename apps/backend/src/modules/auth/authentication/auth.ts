import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type ServiceAccount
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getIdentityRepository } from '../../../core/database/database.js';

export type AuthContext = Readonly<{
  uid: string;
  email: string;
  emailVerified: boolean;
  userId: string | null;
  profileId: string | null;
}>;

export type VerifyIdToken = (token: string) => Promise<AuthContext>;

type FirebaseToken = { uid: string };
type FirebaseUser = {
  uid: string;
  email?: string | null;
  emailVerified: boolean;
};

export type IdentityProjection = {
  userId: string;
  profileId: string | null;
};

export type IdentityRepository = {
  synchronizeExistingIdentity(identity: {
    uid: string;
    email: string;
    emailVerified: boolean;
  }): Promise<IdentityProjection | null>;
};

type FirebaseVerifierDependencies = {
  verifyToken(token: string): Promise<FirebaseToken>;
  getUser(uid: string): Promise<FirebaseUser>;
  identityRepository: IdentityRepository;
};

export function createFirebaseVerifier(
  dependencies: FirebaseVerifierDependencies
): VerifyIdToken {
  return async (token) => {
    const decodedToken = await dependencies.verifyToken(token);
    let firebaseUser: FirebaseUser;
    try {
      firebaseUser = await dependencies.getUser(decodedToken.uid);
    } catch {
      firebaseUser = {
        uid: decodedToken.uid,
        email: ((decodedToken as Record<string, unknown>).email as string | undefined) ?? null,
        emailVerified: Boolean((decodedToken as Record<string, unknown>).email_verified)
      };
    }

    if (!firebaseUser.email) {
      const error = new Error('Firebase identity must expose an email address.');
      error.name = 'AUTH_EMAIL_REQUIRED';
      throw error;
    }

    const identity = {
      uid: firebaseUser.uid,
      email: firebaseUser.email.trim().toLowerCase(),
      emailVerified: firebaseUser.emailVerified
    };
    const projection =
      await dependencies.identityRepository.synchronizeExistingIdentity(identity);

    return Object.freeze({
      ...identity,
      userId: projection?.userId ?? null,
      profileId: projection?.profileId ?? null
    });
  };
}

import fs from 'node:fs';

type FirebaseAdminCredential =
  | { kind: 'json'; serviceAccount: ServiceAccount; checkRevoked: true }
  | { kind: 'file'; checkRevoked: true }
  | { kind: 'emulator' | 'default'; checkRevoked: false };

export function resolveFirebaseAdminCredential(
  environment: NodeJS.ProcessEnv = process.env,
  fileExists: (path: string) => boolean = fs.existsSync
): FirebaseAdminCredential {
  if (environment.FIREBASE_SERVICE_ACCOUNT_JSON !== undefined) {
    let value: unknown;
    try {
      value = JSON.parse(environment.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON.');
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is invalid.');
    }

    const account = value as Record<string, unknown>;
    if (typeof account.project_id !== 'string' || !account.project_id.trim()
      || typeof account.client_email !== 'string' || !account.client_email.trim()
      || typeof account.private_key !== 'string' || !account.private_key.trim()) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing required fields.');
    }

    if (environment.FIREBASE_PROJECT_ID
      && account.project_id !== environment.FIREBASE_PROJECT_ID) {
      throw new Error('Firebase Admin project_id does not match FIREBASE_PROJECT_ID.');
    }

    return {
      kind: 'json',
      serviceAccount: {
        projectId: account.project_id,
        clientEmail: account.client_email,
        privateKey: account.private_key
      },
      checkRevoked: true
    };
  }

  if (environment.VERCEL === '1') {
    throw new Error('Firebase Admin credentials are required on Vercel.');
  }

  const path = environment.GOOGLE_APPLICATION_CREDENTIALS;
  if (path && fileExists(path)) {
    return { kind: 'file', checkRevoked: true };
  }
  if (environment.FIREBASE_AUTH_EMULATOR_HOST) {
    return { kind: 'emulator', checkRevoked: false };
  }
  return { kind: 'default', checkRevoked: false };
}

export function firebaseAuth() {
  const credential = resolveFirebaseAdminCredential();

  let firebaseCredential;
  if (credential.kind === 'json') {
    try {
      firebaseCredential = cert(credential.serviceAccount);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON contains invalid credentials.');
    }
  } else if (credential.kind === 'file') {
    firebaseCredential = applicationDefault();
  }

  const app =
    getApps()[0] ??
    initializeApp({
      ...(firebaseCredential ? { credential: firebaseCredential } : {}),
      ...(process.env.FIREBASE_PROJECT_ID
        ? { projectId: process.env.FIREBASE_PROJECT_ID }
        : {})
    });
  return getAuth(app);
}

export const verifyFirebaseIdToken: VerifyIdToken = (token) => {
  const { checkRevoked } = resolveFirebaseAdminCredential();
  const auth = firebaseAuth();
  return createFirebaseVerifier({
    verifyToken: async (value) => auth.verifyIdToken(value, checkRevoked),
    getUser: async (uid) => auth.getUser(uid),
    identityRepository: getIdentityRepository()
  })(token);
};
