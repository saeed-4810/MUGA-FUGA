"use client";

import { useTranslation } from "react-i18next";

type PendingBadgeProps = {
  count: number;
};

export function PendingBadge({ count }: PendingBadgeProps) {
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
}
