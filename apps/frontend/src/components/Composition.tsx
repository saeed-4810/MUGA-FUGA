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
