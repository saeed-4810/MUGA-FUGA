import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

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
