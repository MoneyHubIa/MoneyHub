export type SessionUser = Readonly<{
  uid: string;
  email: string | null;
}>;

type FirebaseUserLike = SessionUser & {
  getIdToken?: () => Promise<string>;
};

interface FirebaseAuthDependencies {
  createUser(email: string, password: string): Promise<unknown>;
  signIn(email: string, password: string): Promise<unknown>;
  signOut(): Promise<void>;
  observe(callback: (user: FirebaseUserLike | null) => void): () => void;
  getCurrentUser(): FirebaseUserLike | null;
}

export interface AuthService {
  register(email: string, password: string): Promise<void>;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  observeSession(callback: (user: SessionUser | null) => void): () => void;
  getIdToken(): Promise<string | null>;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function createFirebaseAuthService(
  dependencies: FirebaseAuthDependencies
): AuthService {
  return {
    async register(email, password) {
      await dependencies.createUser(normalizeEmail(email), password);
    },
    async login(email, password) {
      await dependencies.signIn(normalizeEmail(email), password);
    },
    async logout() {
      await dependencies.signOut();
    },
    observeSession(callback) {
      return dependencies.observe((user) => {
        callback(user ? { uid: user.uid, email: user.email } : null);
      });
    },
    async getIdToken() {
      const user = dependencies.getCurrentUser();
      return user?.getIdToken ? user.getIdToken() : null;
    }
  };
}
