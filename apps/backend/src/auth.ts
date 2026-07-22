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
    const firebaseUser = await dependencies.getUser(decodedToken.uid);

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

function firebaseAuth() {
  const app =
    getApps()[0] ??
    initializeApp({
      credential: applicationDefault(),
      ...(process.env.FIREBASE_PROJECT_ID
        ? { projectId: process.env.FIREBASE_PROJECT_ID }
        : {})
    });
  return getAuth(app);
}

export const verifyFirebaseIdToken: VerifyIdToken = (token) => {
  const auth = firebaseAuth();
  return createFirebaseVerifier({
    verifyToken: async (value) => auth.verifyIdToken(value, true),
    getUser: async (uid) => auth.getUser(uid),
    identityRepository: getIdentityRepository()
  })(token);
};
