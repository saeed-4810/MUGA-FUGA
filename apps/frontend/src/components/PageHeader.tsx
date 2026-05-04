import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export const PageHeader = ({ title, description, action }: PageHeaderProps) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
      {description ? <p className="text-ink-muted mt-1 text-sm">{description}</p> : null}
    </div>
    {action}
  </div>
);
