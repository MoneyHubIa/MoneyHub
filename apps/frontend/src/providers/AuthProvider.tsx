import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import type { AuthService, SessionUser } from '../services/authService';

type AuthContextValue = Readonly<{
  loading: boolean;
  user: SessionUser | null;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string): Promise<void>;
  resendEmailVerification(): Promise<void>;
  refreshEmailVerification(): Promise<boolean>;
  logout(): Promise<void>;
}>;

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = PropsWithChildren<{
  service: AuthService;
  validateSession?(user: SessionUser): Promise<void>;
}>;

const acceptSession = async () => undefined;

function backendUnavailableError() {
  return Object.assign(
    new Error('Backend session validation failed.'),
    { code: 'auth/backend-unavailable' }
  );
}

export function AuthProvider({
  children,
  service,
  validateSession = acceptSession
}: AuthProviderProps) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);
  const validationGeneration = useRef(0);
  const pendingValidations = useRef(new Map<string, Promise<void>>());

  const validateAndSetSession = useCallback((sessionUser: SessionUser) => {
    const pending = pendingValidations.current.get(sessionUser.uid);
    if (pending) return pending;

    const generation = ++validationGeneration.current;
    setLoading(true);
    setUser(null);

    const validation = (async () => {
      try {
        await validateSession(sessionUser);
        if (generation === validationGeneration.current) {
          setUser(sessionUser);
        }
      } catch {
        if (generation === validationGeneration.current) {
          setUser(null);
        }
        await service.logout();
        throw backendUnavailableError();
      } finally {
        pendingValidations.current.delete(sessionUser.uid);
        if (generation === validationGeneration.current) {
          setLoading(false);
        }
      }
    })();

    pendingValidations.current.set(sessionUser.uid, validation);
    return validation;
  }, [service, validateSession]);

  useEffect(
    () =>
      service.observeSession((sessionUser) => {
        if (!sessionUser) {
          validationGeneration.current += 1;
          setUser(null);
          setLoading(false);
          return;
        }

        void validateAndSetSession(sessionUser).catch(() => undefined);
      }),
    [service, validateAndSetSession]
  );

  const login = useCallback(async (email: string, password: string) => {
    const sessionUser = await service.login(email, password);
    await validateAndSetSession(sessionUser);
  }, [service, validateAndSetSession]);

  const refreshEmailVerification = useCallback(async () => {
    const refreshedUser = await service.refreshEmailVerification();
    setUser(refreshedUser);
    return refreshedUser.emailVerified;
  }, [service]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      user,
      login,
      register: service.register,
      resendEmailVerification: service.resendEmailVerification,
      refreshEmailVerification,
      logout: service.logout
    }),
    [loading, login, refreshEmailVerification, service, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}

