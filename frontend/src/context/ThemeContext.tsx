import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { themeNames, type ThemeName } from "../theme/tokens";

interface ThemeContextType {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  isDarkTheme: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_CLASS_PREFIX = "theme-";
const FALLBACK_THEME: ThemeName = "shadcn-admin";

function getUserScopedStorageKey(): string {
  try {
    const rawUser = localStorage.getItem("user");
    if (!rawUser) return "setu.theme";
    const user = JSON.parse(rawUser) as {
      id?: number | string;
      username?: string;
    };
    if (user?.id !== undefined && user?.id !== null)
      return `setu.theme.user.${user.id}`;
    if (user?.username) return `setu.theme.user.${user.username}`;
    return "setu.theme";
  } catch {
    return "setu.theme";
  }
}

function resolveInitialTheme(): ThemeName {
  const key = getUserScopedStorageKey();
  const stored = localStorage.getItem(key);
  if (stored && themeNames.includes(stored as ThemeName)) {
    return stored as ThemeName;
  }
  return FALLBACK_THEME;
}

function applyThemeClass(theme: ThemeName) {
  const root = document.documentElement;
  const classNames = Array.from(root.classList);
  classNames
    .filter((className) => className.startsWith(THEME_CLASS_PREFIX))
    .forEach((className) => root.classList.remove(className));
  root.classList.add(`${THEME_CLASS_PREFIX}${theme}`);
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<ThemeName>(() =>
    resolveInitialTheme(),
  );

  useEffect(() => {
    applyThemeClass(theme);
    const key = getUserScopedStorageKey();
    localStorage.setItem(key, theme);
  }, [theme]);

  // Handle account switch/login/logout in the same browser tab.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "user" || event.key === "token") {
        const nextTheme = resolveInitialTheme();
        setThemeState(nextTheme);
      }
    };
    const handleAuthChange = () => {
      const nextTheme = resolveInitialTheme();
      setThemeState(nextTheme);
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("setu-auth-changed", handleAuthChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("setu-auth-changed", handleAuthChange);
    };
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme: setThemeState,
      isDarkTheme: theme === "horizon-ui" || theme === "setu-modern-pro",
    }),
    [theme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
