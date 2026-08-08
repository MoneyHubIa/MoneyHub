import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
}>;

export function AuthProvider({ children, service }: AuthProviderProps) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(
    () =>
      service.observeSession((sessionUser) => {
        setUser(sessionUser);
        setLoading(false);
      }),
    [service]
  );

  const refreshEmailVerification = useCallback(async () => {
    const refreshedUser = await service.refreshEmailVerification();
    setUser(refreshedUser);
    return refreshedUser.emailVerified;
  }, [service]);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      user,
      login: service.login,
      register: service.register,
      resendEmailVerification: service.resendEmailVerification,
      refreshEmailVerification,
      logout: service.logout
    }),
    [loading, refreshEmailVerification, service, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}

