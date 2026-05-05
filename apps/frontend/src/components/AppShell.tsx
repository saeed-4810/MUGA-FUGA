import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, NavLink, useLocation } from "react-router-dom";

import { AuthProvider, useAuth } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
import { api } from "../lib/api";

import { LocaleSwitcher } from "./LocaleSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

const usePendingReviewCount = (enabled: boolean) => {
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    void Promise.all([
      api.get<{ items: unknown[] }>("/products?status=pending"),
      api.get<{ items: unknown[] }>("/artists?status=pending"),
    ])
      .then(([products, artists]) => setCount(products.items.length + artists.items.length))
      .catch(() => setCount(0));
  }, [enabled]);

  useEffect(() => {
    refresh();
    if (!enabled) return undefined;
    const id = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", refresh);
    };
  }, [enabled, refresh]);

  return count;
};

const PendingBadge = ({ count }: { count: number }) => {
  const { t } = useTranslation("common");
  if (count <= 0) return null;
  return (
    <span
      className="bg-brand-500 ml-auto rounded-full px-2 py-0.5 text-xs font-bold text-white"
      aria-label={t("nav.pendingReview", { count })}
    >
      {count}
    </span>
  );
};

const Sidebar = () => {
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const pendingCount = usePendingReviewCount(isAdmin);
  const navItem = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
      isActive
        ? "bg-brand-500/15 text-brand-700 dark:text-brand-300"
        : "text-ink-muted hover:bg-surface-muted"
    }`;
  return (
    <aside className="border-line bg-surface hidden w-60 shrink-0 border-r px-3 py-4 lg:block">
      <div className="mb-6 px-2 text-xl font-bold tracking-tight">MUGA</div>
      <nav className="flex flex-col gap-1" aria-label={t("nav.aria")}>
        <NavLink to="/" end className={navItem}>
          {t("nav.dashboard")}
        </NavLink>
        <NavLink to="/products" className={navItem}>
          {t("nav.products")}
        </NavLink>
        <NavLink to="/products/new" className={navItem}>
          {t("nav.createProduct")}
        </NavLink>
        {isAdmin && (
          <>
            <NavLink to="/admin/artists" className={navItem}>
              {t("nav.artists")}
            </NavLink>
            <NavLink to="/admin/queue" className={navItem}>
              <span>{t("nav.adminQueue")}</span>
              <PendingBadge count={pendingCount} />
            </NavLink>
          </>
        )}
      </nav>
    </aside>
  );
};

const TopBar = () => {
  const { t } = useTranslation("common");
  const location = useLocation();
  return (
    <header className="border-line bg-surface/80 flex h-14 items-center justify-between border-b px-4 backdrop-blur-md">
      <div className="font-bold lg:hidden">MUGA</div>
      <div className="text-ink-muted hidden text-sm lg:block" aria-live="polite">
        {t("topbar.path", { path: location.pathname })}
      </div>
      <div className="flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
};

const ShellInner = () => (
  <div className="bg-surface text-ink flex min-h-screen">
    <Sidebar />
    <div className="flex flex-1 flex-col">
      <TopBar />
      <main className="animate-fade-in flex-1 px-4 py-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  </div>
);

export const AppShell = () => (
  <ThemeProvider>
    <AuthProvider>
      <ShellInner />
    </AuthProvider>
  </ThemeProvider>
);
