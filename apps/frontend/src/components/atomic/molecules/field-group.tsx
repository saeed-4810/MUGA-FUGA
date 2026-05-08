import type { ReactNode } from "react";

interface FieldGroupProps {
  children: ReactNode;
  description?: ReactNode;
  title: ReactNode;
}

export const FieldGroup = ({ children, description, title }: FieldGroupProps) => (
  <div className="space-y-4">
    <div className="space-y-1">
      <h2 className="font-display text-foreground text-base font-semibold tracking-tight sm:text-lg">
        {title}
      </h2>
      {description ? (
        <p className="text-muted-foreground text-sm leading-6">{description}</p>
      ) : null}
    </div>
    <div className="space-y-4">{children}</div>
  </div>
);
