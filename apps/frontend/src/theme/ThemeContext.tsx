import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { ColorTokens, ThemeMode, tokens } from './tokens';

export const THEME_STORAGE_KEY = '@moneyhub:theme_mode';

export interface ThemeContextValue {
  theme: ColorTokens;
  isDark: boolean;
  mode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: React.ReactNode;
  initialMode?: ThemeMode;
  onThemeChange?: (mode: ThemeMode) => void;
}

export function ThemeProvider({
  children,
  initialMode,
  onThemeChange
}: ThemeProviderProps): React.JSX.Element {
  const [mode, setModeState] = useState<ThemeMode>(initialMode ?? 'dark');

  useEffect(() => {
    let isMounted = true;
    async function loadStoredTheme(): Promise<void> {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (isMounted && (stored === 'dark' || stored === 'light')) {
          setModeState(stored);
        }
      } catch {
        // Fallback silently to dark mode
      }
    }
    void loadStoredTheme();
    return () => {
      isMounted = false;
    };
  }, []);

  const setThemeMode = useCallback(
    (newMode: ThemeMode) => {
      setModeState(newMode);
      void AsyncStorage.setItem(THEME_STORAGE_KEY, newMode).catch(() => undefined);
      onThemeChange?.(newMode);
    },
    [onThemeChange]
  );

  const toggleTheme = useCallback(() => {
    const nextMode: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    setThemeMode(nextMode);
  }, [mode, setThemeMode]);

  const value = useMemo<ThemeContextValue>(() => {
    return {
      theme: tokens[mode],
      isDark: mode === 'dark',
      mode,
      toggleTheme,
      setThemeMode
    };
  }, [mode, toggleTheme, setThemeMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
