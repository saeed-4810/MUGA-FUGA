import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type StatusBannerTone = "default" | "success" | "warning" | "danger";

const toneClasses: Record<StatusBannerTone, string> = {
  default: "border-border bg-muted/50 text-foreground",
  success: "border-primary/40 bg-primary/10 text-foreground",
  warning: "border-ring/40 bg-accent text-accent-foreground",
  danger: "border-destructive/40 bg-destructive/10 text-destructive dark:text-red-200",
};

interface StatusBannerProps {
  children: ReactNode;
  className?: string;
  role?: "alert" | "status";
  tone?: StatusBannerTone;
}

export const StatusBanner = ({
  children,
  className,
  role = "status",
  tone = "default",
}: StatusBannerProps) => (
  <div
    className={cn("rounded-xl border p-3 text-sm leading-6", toneClasses[tone], className)}
    role={role}
  >
    {children}
  </div>
);
