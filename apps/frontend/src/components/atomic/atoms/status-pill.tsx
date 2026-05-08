import { cn } from "@/lib/utils";

export type StatusPillTone =
  | "pending"
  | "published"
  | "rejected"
  | "neutral"
  | "success"
  | "warning"
  | "danger";

const toneClasses: Record<StatusPillTone, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  published: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  rejected: "border-destructive/30 bg-destructive/10 text-destructive dark:text-red-200",
  neutral: "border-border bg-muted/60 text-muted-foreground",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  danger: "border-destructive/30 bg-destructive/10 text-destructive dark:text-red-200",
};

interface StatusPillProps {
  children: string;
  className?: string;
  tone?: StatusPillTone;
}

export const StatusPill = ({ children, className, tone = "neutral" }: StatusPillProps) => (
  <span
    className={cn(
      "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-wider",
      toneClasses[tone],
      className
    )}
  >
    {children}
  </span>
);
