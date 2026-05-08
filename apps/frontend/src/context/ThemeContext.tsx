import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "muga.theme";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const isTheme = (value: string | null | undefined): value is Theme =>
  value === "light" || value === "dark" || value === "system";

const readStoredTheme = (fallback: Theme): Theme => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    /* ignore */
  }
  return fallback;
};

const systemPrefersDark = (): boolean =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;

const resolve = (t: Theme): ResolvedTheme =>
  t === "system" ? (systemPrefersDark() ? "dark" : "light") : t;

const resolveForHydration = (t: Theme): ResolvedTheme => (t === "dark" ? "dark" : "light");

const applyDocumentClass = (resolved: ResolvedTheme): void => {
  const root = document.documentElement;
  if (resolved === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.style.colorScheme = resolved;
};

const persistTheme = (theme: Theme): void => {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${STORAGE_KEY}=${theme}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
};

export const ThemeProvider = ({
  children,
  initialTheme = "system",
}: {
  children: ReactNode;
  initialTheme?: Theme;
}) => {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolveForHydration(initialTheme));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const storedTheme = readStoredTheme(initialTheme);
    setThemeState(storedTheme);
    setResolved(resolve(storedTheme));
    setReady(true);
  }, [initialTheme]);

  // Apply class + persist
  useEffect(() => {
    if (!ready) return;
    applyDocumentClass(resolved);
    persistTheme(theme);
  }, [ready, theme, resolved]);

  // Sync with system changes when theme is "system"
  useEffect(() => {
    if (!ready || theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolved(mq.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    setResolved(resolve(t));
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = resolved === "dark" ? "light" : "dark";
    setThemeState(next);
    setResolved(next);
  }, [resolved]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolved, setTheme, toggle }),
    [theme, resolved, setTheme, toggle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider />");
  return ctx;
};
