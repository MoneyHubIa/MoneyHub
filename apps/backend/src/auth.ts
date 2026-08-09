import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getIdentityRepository } from './database.js';

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

export function firebaseAuth() {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasCredFile = credPath && fs.existsSync(credPath);

  const app =
    getApps()[0] ??
    initializeApp({
      ...(hasCredFile ? { credential: applicationDefault() } : {}),
      ...(process.env.FIREBASE_PROJECT_ID
        ? { projectId: process.env.FIREBASE_PROJECT_ID }
        : {})
    });
  return getAuth(app);
}

export const verifyFirebaseIdToken: VerifyIdToken = (token) => {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasCredFile = Boolean(credPath && fs.existsSync(credPath));
  const auth = firebaseAuth();
  return createFirebaseVerifier({
    verifyToken: async (value) => auth.verifyIdToken(value, hasCredFile),
    getUser: async (uid) => auth.getUser(uid),
    identityRepository: getIdentityRepository()
  })(token);
};
