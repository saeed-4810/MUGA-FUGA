import { Menu, X } from "lucide-react";
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
      className="bg-secondary text-secondary-foreground ml-auto rounded-full px-2 py-0.5 text-xs font-bold"
      aria-label={t("nav.pendingReview", { count })}
    >
      {count}
    </span>
  );
};

const NAV_ITEM_BASE =
  "flex min-h-11 items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors";
const NAV_ITEM_ACTIVE = "bg-accent text-accent-foreground shadow-glow";
const NAV_ITEM_IDLE = "text-muted-foreground hover:bg-muted hover:text-foreground";

const BrandMark = () => (
  <h1 className="px-2">
    <img alt="FUGA" className="h-8 w-auto brightness-0 dark:brightness-100" src="/fuga-logo.svg" />
  </h1>
);

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `${NAV_ITEM_BASE} ${isActive ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE}`;

const nestedNavItemClass = ({ isActive }: { isActive: boolean }) =>
  `${NAV_ITEM_BASE} ml-5 min-h-10 pl-4 ${isActive ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE}`;

const NavigationLinks = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const pendingCount = usePendingReviewCount(isAdmin);
  return (
    <nav className="flex flex-col gap-1.5" aria-label={t("nav.aria")}>
      <NavLink to="/" end className={navItemClass} onClick={onNavigate}>
        {t("nav.dashboard")}
      </NavLink>
      <div className="space-y-1" role="group" aria-label={t("nav.products")}>
        <NavLink to="/products" className={navItemClass} onClick={onNavigate}>
          {t("nav.products")}
        </NavLink>
        <NavLink to="/products/new" className={nestedNavItemClass} onClick={onNavigate}>
          {t("nav.createProduct")}
        </NavLink>
      </div>
      {isAdmin && (
        <>
          <NavLink to="/admin/artists" className={navItemClass} onClick={onNavigate}>
            {t("nav.artists")}
          </NavLink>
          <NavLink to="/admin/queue" className={navItemClass} onClick={onNavigate}>
            <span>{t("nav.adminQueue")}</span>
            <PendingBadge count={pendingCount} />
          </NavLink>
        </>
      )}
    </nav>
  );
};

const Sidebar = () => (
  <aside className="border-border hidden w-64 shrink-0 border-r bg-transparent px-4 py-5 lg:block">
    <div className="mb-8">
      <BrandMark />
    </div>
    <NavigationLinks />
  </aside>
);

const MobileNavigation = ({ onClose, open }: { onClose: () => void; open: boolean }) => {
  const { t } = useTranslation("common");
  if (!open) return null;
  return (
    <div
      aria-label={t("nav.mobileMenu")}
      aria-modal="true"
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
    >
      <button
        aria-label={t("nav.closeMenuBackdrop")}
        className="bg-background/70 absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
        type="button"
      />
      <aside className="animate-fade-in border-border bg-background/95 relative flex h-full w-[min(20rem,86vw)] flex-col gap-8 border-r px-4 py-5 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between gap-4">
          <BrandMark />
          <button
            aria-label={t("nav.closeMenu")}
            className="text-foreground hover:bg-muted grid min-h-11 min-w-11 place-items-center rounded-2xl"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <NavigationLinks onNavigate={onClose} />
      </aside>
    </div>
  );
};

const TopBar = ({ onOpenMenu }: { onOpenMenu: () => void }) => {
  const { t } = useTranslation("common");
  const location = useLocation();
  return (
    <header className="border-border bg-background/85 sticky top-0 z-40 flex min-h-16 items-center justify-between border-b px-3 backdrop-blur-md sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <button
          aria-label={t("nav.openMenu")}
          className="bg-primary text-primary-foreground shadow-soft hover:bg-primary/90 grid min-h-11 min-w-11 place-items-center rounded-2xl transition-colors lg:hidden"
          onClick={onOpenMenu}
          type="button"
        >
          <Menu aria-hidden="true" className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <img
            alt="FUGA"
            className="h-5 w-auto brightness-0 lg:hidden dark:brightness-100"
            src="/fuga-logo.svg"
          />
          <div className="text-muted-foreground hidden text-sm lg:block" aria-live="polite">
            {t("topbar.path", { path: location.pathname })}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <LocaleSwitcher />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
};

const ShellInner = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  return (
    <div className="bg-background text-foreground flex min-h-screen">
      <Sidebar />
      <MobileNavigation onClose={() => setMobileNavOpen(false)} open={mobileNavOpen} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMenu={() => setMobileNavOpen(true)} />
        <main className="animate-fade-in flex-1 px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

/**
 * `AppProviders` — root context wrapper used by every layout (chrome and
 * chrome-less). Centralises Theme + Auth so authenticated state is shared
 * across `AppShell` (post-auth) and `AuthLayout` (pre-auth) without
 * re-mounting the AuthProvider on navigation between them.
 */
export const AppProviders = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <AuthProvider>{children}</AuthProvider>
  </ThemeProvider>
);

/**
 * `AuthLayout` — chrome-less layout for pre-auth routes (e.g. `/login`).
 * Mounts the same providers as `AppShell` but renders neither Sidebar nor
 * TopBar, so the login screen is a true overlay rather than embedded inside
 * the post-auth chrome. The fix is at the router/JS layer (separate route
 * branches), not at the CSS layer (no `display:none` tricks).
 */
export const AuthLayout = () => (
  <AppProviders>
    <main className="bg-surface text-ink animate-fade-in min-h-screen">
      <Outlet />
    </main>
  </AppProviders>
);

export const AppShell = () => (
  <AppProviders>
    <ShellInner />
  </AppProviders>
);
