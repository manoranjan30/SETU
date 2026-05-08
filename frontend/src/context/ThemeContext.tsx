/* eslint-disable react-refresh/only-export-components */
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
  zoomLevel: number;
  setZoomLevel: (zoomLevel: number) => void;
  isDarkTheme: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_CLASS_PREFIX = "theme-";
const FALLBACK_THEME: ThemeName = "shadcn-admin";
const ZOOM_LEVELS = [0.8, 0.9, 1] as const;
const FALLBACK_ZOOM_LEVEL = 0.8;

function getUserScopedStorageKey(setting: "theme" | "zoom"): string {
  try {
    const rawUser = localStorage.getItem("user");
    if (!rawUser) return `setu.${setting}`;
    const user = JSON.parse(rawUser) as {
      id?: number | string;
      username?: string;
    };
    if (user?.id !== undefined && user?.id !== null)
      return `setu.${setting}.user.${user.id}`;
    if (user?.username) return `setu.${setting}.user.${user.username}`;
    return `setu.${setting}`;
  } catch {
    return `setu.${setting}`;
  }
}

function resolveInitialTheme(): ThemeName {
  const key = getUserScopedStorageKey("theme");
  const stored = localStorage.getItem(key);
  if (stored && themeNames.includes(stored as ThemeName)) {
    return stored as ThemeName;
  }
  return FALLBACK_THEME;
}

function resolveInitialZoomLevel(): number {
  const key = getUserScopedStorageKey("zoom");
  const stored = localStorage.getItem(key);
  if (!stored) return FALLBACK_ZOOM_LEVEL;
  const parsed = Number(stored);
  return ZOOM_LEVELS.includes(parsed as (typeof ZOOM_LEVELS)[number])
    ? parsed
    : FALLBACK_ZOOM_LEVEL;
}

function applyThemeClass(theme: ThemeName) {
  const root = document.documentElement;
  const classNames = Array.from(root.classList);
  classNames
    .filter((className) => className.startsWith(THEME_CLASS_PREFIX))
    .forEach((className) => root.classList.remove(className));
  root.classList.add(`${THEME_CLASS_PREFIX}${theme}`);
}

function applyZoomLevel(zoomLevel: number) {
  document.documentElement.style.zoom = "";
  document.documentElement.style.fontSize = `${zoomLevel * 100}%`;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<ThemeName>(() =>
    resolveInitialTheme(),
  );
  const [zoomLevel, setZoomLevelState] = useState<number>(() =>
    resolveInitialZoomLevel(),
  );

  useEffect(() => {
    applyThemeClass(theme);
    const key = getUserScopedStorageKey("theme");
    localStorage.setItem(key, theme);
  }, [theme]);

  useEffect(() => {
    applyZoomLevel(zoomLevel);
    const key = getUserScopedStorageKey("zoom");
    localStorage.setItem(key, String(zoomLevel));
  }, [zoomLevel]);

  // Handle account switch/login/logout in the same browser tab.
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "user" || event.key === "token") {
        const nextTheme = resolveInitialTheme();
        const nextZoomLevel = resolveInitialZoomLevel();
        setThemeState(nextTheme);
        setZoomLevelState(nextZoomLevel);
      }
    };
    const handleAuthChange = () => {
      const nextTheme = resolveInitialTheme();
      const nextZoomLevel = resolveInitialZoomLevel();
      setThemeState(nextTheme);
      setZoomLevelState(nextZoomLevel);
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
      zoomLevel,
      setZoomLevel: setZoomLevelState,
      isDarkTheme: theme === "horizon-ui" || theme === "setu-modern-pro",
    }),
    [theme, zoomLevel],
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
