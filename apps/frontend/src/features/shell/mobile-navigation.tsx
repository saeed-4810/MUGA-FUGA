"use client";

import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { BrandMark } from "./brand-mark";
import { ShellNavigation } from "./shell-navigation";

type MobileNavigationProps = {
  onClose: () => void;
  open: boolean;
  pendingReviewCount: number;
};

export function MobileNavigation({ onClose, open, pendingReviewCount }: MobileNavigationProps) {
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
        <ShellNavigation onNavigate={onClose} pendingReviewCount={pendingReviewCount} />
      </aside>
    </div>
  );
}
