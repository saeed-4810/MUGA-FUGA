"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";

import { getNavItemClass, shellNavItems } from "./nav-items";
import { PendingBadge } from "./pending-badge";
import { usePendingReviewCount } from "./use-pending-review-count";

import { useAuth } from "@/context/AuthContext";

type ShellNavigationProps = {
  onNavigate?: () => void;
  pendingReviewCount: number;
};

export function ShellNavigation({ onNavigate, pendingReviewCount }: ShellNavigationProps) {
  const pathname = usePathname();
  const { t } = useTranslation("common");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const pendingCount = usePendingReviewCount(isAdmin, pendingReviewCount);

  return (
    <nav aria-label={t("nav.aria")} className="flex flex-col gap-1.5">
      {shellNavItems
        .filter((item) => !item.admin || isAdmin)
        .map((item) => (
          <Link
            key={item.href}
            className={getNavItemClass(pathname === item.href, item.nested)}
            href={item.href}
            {...(onNavigate ? { onClick: onNavigate } : {})}
          >
            <span>{t(`nav.${item.key}`)}</span>
            {item.badge ? <PendingBadge count={pendingCount} /> : null}
          </Link>
        ))}
    </nav>
  );
}
