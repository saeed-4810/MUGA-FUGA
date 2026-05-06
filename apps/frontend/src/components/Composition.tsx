import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warning" | "danger";

const toneClasses: Record<Tone, string> = {
  default: "border-border bg-muted/50 text-foreground",
  success: "border-primary/40 bg-primary/10 text-foreground",
  warning: "border-ring/40 bg-accent text-accent-foreground",
  danger: "border-destructive/40 bg-destructive/10 text-destructive dark:text-red-200",
};

interface PageSurfaceProps {
  children: ReactNode;
  className?: string;
  variant?: "plain" | "panel";
}

export const PageSurface = ({ children, className, variant = "plain" }: PageSurfaceProps) => (
  <section
    className={cn(
      "animate-fade-in mx-auto w-full max-w-6xl",
      variant === "panel" && "border-border bg-card/80 shadow-soft rounded-3xl border p-4 sm:p-6",
      className
    )}
  >
    {children}
  </section>
);

interface FieldGroupProps {
  children: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}

export const FieldGroup = ({ children, description, title }: FieldGroupProps) => (
  <div className="border-border bg-background/60 rounded-2xl border p-4 shadow-sm sm:p-5">
    <div className="mb-4 space-y-1">
      <h2 className="font-display text-foreground text-lg font-semibold tracking-tight">{title}</h2>
      {description ? (
        <p className="text-muted-foreground text-sm leading-6">{description}</p>
      ) : null}
    </div>
    <div className="space-y-4">{children}</div>
  </div>
);

interface StatusBannerProps {
  children: ReactNode;
  className?: string;
  role?: "alert" | "status";
  tone?: Tone;
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

interface WizardStep {
  id: string;
  label: string;
  description: string;
  state?: "active" | "complete" | "pending";
}

interface WizardStepsProps {
  label: string;
  steps: readonly WizardStep[];
}

export const WizardSteps = ({ label, steps }: WizardStepsProps) => (
  <ol aria-label={label} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {steps.map((step, index) => {
      const state = step.state ?? "pending";
      return (
        <li
          aria-current={state === "active" ? "step" : undefined}
          className={cn(
            "border-border bg-card rounded-2xl border p-4 text-sm shadow-sm",
            state === "active" && "border-primary/60 bg-primary/10",
            state === "complete" && "border-primary/40 bg-primary/10"
          )}
          key={step.id}
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="bg-primary text-primary-foreground grid h-7 w-7 place-items-center rounded-full text-xs font-semibold">
              {index + 1}
            </span>
            <span className="text-foreground font-medium">{step.label}</span>
          </div>
          <p className="text-muted-foreground text-xs leading-5">{step.description}</p>
        </li>
      );
    })}
  </ol>
);

interface TableCompositionProps {
  children: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}

export const TableComposition = ({ children, description, title }: TableCompositionProps) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-xl">{title}</CardTitle>
      {description ? <CardDescription>{description}</CardDescription> : null}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

interface DialogCompositionProps {
  actions?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}

export const DialogComposition = ({
  actions,
  children,
  description,
  title,
}: DialogCompositionProps) => (
  <div className="space-y-4">
    <div className="space-y-1.5">
      <h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>
      {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
    </div>
    <div className="space-y-4">{children}</div>
    {actions ? (
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{actions}</div>
    ) : null}
  </div>
);

type SkeletonShape = "card" | "row" | "text";

interface LoadingSkeletonProps {
  /** Accessible description of what is loading. Required for screen readers. */
  label: string;
  /** Number of placeholder elements to render. Defaults to 1. */
  count?: number;
  /** Visual shape of each placeholder. Defaults to "card". */
  shape?: SkeletonShape;
  /** Optional grid wrapper for `card` shapes — applies a responsive grid. */
  grid?: boolean;
  className?: string;
}

const skeletonShapeClasses: Record<SkeletonShape, string> = {
  card: "border-border bg-card h-56 rounded-2xl border shadow-sm",
  row: "border-border bg-card h-12 rounded-xl border",
  text: "bg-muted h-4 w-full rounded",
};

/**
 * `LoadingSkeleton` — accessible placeholder shown while content is being fetched.
 * Wraps each placeholder with `aria-busy="true"` so assistive tech announces the
 * loading region. Respects `prefers-reduced-motion` via the global CSS rule
 * (no per-component override needed).
 */
export const LoadingSkeleton = ({
  label,
  count = 1,
  shape = "card",
  grid = false,
  className,
}: LoadingSkeletonProps) => {
  const items = Array.from({ length: count }).map((_, index) => (
    <div
      aria-busy="true"
      className={cn("animate-pulse", skeletonShapeClasses[shape])}
      key={index}
    />
  ));
  return (
    <div
      aria-label={label}
      className={cn(grid ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-3", className)}
      role="status"
    >
      {items}
    </div>
  );
};

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** Optional CTA — typically a `<Link>` or `<Button>`. */
  action?: ReactNode;
  className?: string;
}

/**
 * `EmptyState` — calm, centered card shown when a list/table has no rows.
 * Title is always visible; description and action are optional.
 */
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

interface ErrorStateProps {
  children: ReactNode;
  className?: string;
}

/**
 * `ErrorState` — semantic alias for `<StatusBanner role="alert" tone="danger">`.
 * Use this when surfacing API or runtime errors so consumer pages stay readable.
 */
export const ErrorState = ({ children, className }: ErrorStateProps) => (
  <StatusBanner {...(className ? { className } : {})} role="alert" tone="danger">
    {children}
  </StatusBanner>
);
