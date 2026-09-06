export type SessionUser = Readonly<{
  uid: string;
  email: string | null;
  emailVerified: boolean;
}>;

type FirebaseUserLike = SessionUser & {
  reload?: () => Promise<void>;
  getIdToken?: (forceRefresh?: boolean) => Promise<string>;
};

type FirebaseCredentialLike = Readonly<{ user: FirebaseUserLike }>;

interface FirebaseAuthDependencies {
  createUser(email: string, password: string): Promise<FirebaseCredentialLike>;
  sendVerification(user: FirebaseUserLike): Promise<void>;
  signIn(email: string, password: string): Promise<FirebaseCredentialLike>;
  signOut(): Promise<void>;
  observe(callback: (user: FirebaseUserLike | null) => void): () => void;
  getCurrentUser(): FirebaseUserLike | null;
}

export interface AuthService {
  register(email: string, password: string): Promise<void>;
  resendEmailVerification(): Promise<void>;
  refreshEmailVerification(): Promise<SessionUser>;
  login(email: string, password: string): Promise<SessionUser>;
  logout(): Promise<void>;
  observeSession(callback: (user: SessionUser | null) => void): () => void;
  getIdToken(): Promise<string | null>;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toSessionUser(user: FirebaseUserLike): SessionUser {
  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified
  };
}

function requireCurrentUser(dependencies: FirebaseAuthDependencies) {
  const user = dependencies.getCurrentUser();
  if (!user) throw new Error('No authenticated Firebase user.');
  return user;
}

export function createFirebaseAuthService(
  dependencies: FirebaseAuthDependencies
): AuthService {
  return {
    async register(email, password) {
      const credential = await dependencies.createUser(
        normalizeEmail(email),
        password
      );
      await dependencies.sendVerification(credential.user);
    },
    async resendEmailVerification() {
      await dependencies.sendVerification(requireCurrentUser(dependencies));
    },
    async refreshEmailVerification() {
      const user = requireCurrentUser(dependencies);
      if (!user.reload || !user.getIdToken) {
        throw new Error('Firebase user cannot refresh email verification.');
      }
      await user.reload();
      await user.getIdToken(true);
      return toSessionUser(user);
    },
    async login(email, password) {
      const credential = await dependencies.signIn(
        normalizeEmail(email),
        password
      );
      return toSessionUser(credential.user);
    },
    async logout() {
      await dependencies.signOut();
    },
    observeSession(callback) {
      return dependencies.observe((user) => {
        callback(user ? toSessionUser(user) : null);
      });
    },
    async getIdToken() {
      const user = dependencies.getCurrentUser();
      return user?.getIdToken ? user.getIdToken() : null;
    }
  };
}
