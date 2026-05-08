"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

import { LocaleSwitcher } from "./LocaleSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";

const navItems: Array<{
  href: string;
  key: "adminQueue" | "artists" | "createProduct" | "dashboard" | "products";
  admin?: boolean;
  badge?: boolean;
  nested?: boolean;
}> = [
  { href: "/", key: "dashboard" },
  { href: "/products", key: "products" },
  { href: "/products/new", key: "createProduct", nested: true },
  { href: "/admin/artists", key: "artists", admin: true },
  { href: "/admin/queue", key: "adminQueue", admin: true, badge: true },
];

const NAV_ITEM_BASE =
  "flex min-h-11 items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors";
const NAV_ITEM_ACTIVE = "bg-accent text-accent-foreground shadow-glow";
const NAV_ITEM_IDLE = "text-muted-foreground hover:bg-muted hover:text-foreground";

const linkClass = (active: boolean, nested = false) =>
  `${NAV_ITEM_BASE} ${nested ? "ml-5 min-h-10 pl-4" : ""} ${active ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE}`;

const usePendingReviewCount = (enabled: boolean, initialCount: number) => {
  const [count, setCount] = useState(initialCount);

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
      .catch(() => setCount(initialCount));
  }, [enabled, initialCount]);

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

const BrandMark = ({ compact = false }: { compact?: boolean }) => (
  <h1 className={compact ? "" : "px-2"}>
    <img
      alt="FUGA"
      className={`${compact ? "h-5" : "h-8"} w-auto brightness-0 dark:brightness-100`}
      src="/fuga-logo.svg"
    />
  </h1>
);

const PendingBadge = ({ count }: { count: number }) => {
  const { t } = useTranslation("common");
  if (count <= 0) return null;
  return (
    <span
      aria-label={t("nav.pendingReview", { count })}
      className="bg-secondary text-secondary-foreground ml-auto rounded-full px-2 py-0.5 text-xs font-bold"
    >
      {count}
    </span>
  );
};

const Navigation = ({
  onNavigate,
  pendingReviewCount,
}: {
  onNavigate?: () => void;
  pendingReviewCount: number;
}) => {
  const pathname = usePathname();
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const pendingCount = usePendingReviewCount(isAdmin, pendingReviewCount);
  return (
    <nav aria-label={t("nav.aria")} className="flex flex-col gap-1.5">
      {navItems
        .filter((item) => !item.admin || isAdmin)
        .map((item) => (
          <Link
            key={item.href}
            className={linkClass(pathname === item.href, item.nested)}
            href={item.href}
            {...(onNavigate ? { onClick: onNavigate } : {})}
          >
            <span>{t(`nav.${item.key}`)}</span>
            {item.badge ? <PendingBadge count={pendingCount} /> : null}
          </Link>
        ))}
    </nav>
  );
};

const Sidebar = ({ pendingReviewCount }: { pendingReviewCount: number }) => (
  <aside className="border-border hidden w-64 shrink-0 border-r bg-transparent px-4 py-5 lg:block">
    <div className="mb-8">
      <BrandMark />
    </div>
    <Navigation pendingReviewCount={pendingReviewCount} />
  </aside>
);

const MobileNavigation = ({
  onClose,
  open,
  pendingReviewCount,
}: {
  onClose: () => void;
  open: boolean;
  pendingReviewCount: number;
}) => {
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
        <Navigation onNavigate={onClose} pendingReviewCount={pendingReviewCount} />
      </aside>
    </div>
  );
};

const TopBar = ({ onOpenMenu }: { onOpenMenu: () => void }) => {
  const pathname = usePathname();
  const { t } = useTranslation("common");
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
          <div className="lg:hidden">
            <BrandMark compact />
          </div>
          <div className="text-muted-foreground hidden text-sm lg:block" aria-live="polite">
            {t("topbar.path", { path: pathname })}
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

export const AppShell = ({
  children,
  initialPendingReviewCount = 0,
}: {
  children: ReactNode;
  initialPendingReviewCount?: number;
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="bg-background text-foreground flex min-h-screen">
      <Sidebar pendingReviewCount={initialPendingReviewCount} />
      <MobileNavigation
        onClose={() => setMobileOpen(false)}
        open={mobileOpen}
        pendingReviewCount={initialPendingReviewCount}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMenu={() => setMobileOpen(true)} />
        <main className="animate-fade-in flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
};
