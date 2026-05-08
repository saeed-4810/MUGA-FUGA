"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";

import { BrandMark } from "./brand-mark";
import { ShellControls } from "./shell-controls";

type TopBarProps = {
  onOpenMenu: () => void;
};

export function TopBar({ onOpenMenu }: TopBarProps) {
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
      <ShellControls />
    </header>
  );
}
