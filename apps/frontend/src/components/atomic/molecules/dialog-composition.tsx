import type { ReactNode } from "react";

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
