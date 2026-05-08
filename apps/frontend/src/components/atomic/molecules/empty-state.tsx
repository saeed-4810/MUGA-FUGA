import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  action?: ReactNode;
  className?: string;
  description?: ReactNode;
  title: ReactNode;
}

export const EmptyState = ({ action, className, description, title }: EmptyStateProps) => (
  <div
    className={cn("border-border bg-card rounded-2xl border p-10 text-center shadow-sm", className)}
  >
    <h2 className="text-foreground text-lg font-semibold">{title}</h2>
    {description ? (
      <p className="text-muted-foreground mt-2 text-sm leading-6">{description}</p>
    ) : null}
    {action ? <div className="mt-4 inline-flex">{action}</div> : null}
  </div>
);
