import type { ReactNode } from "react";

import { StatusBanner } from "../atoms/status-banner";

interface ErrorStateProps {
  children: ReactNode;
  className?: string;
}

export const ErrorState = ({ children, className }: ErrorStateProps) => (
  <StatusBanner {...(className ? { className } : {})} role="alert" tone="danger">
    {children}
  </StatusBanner>
);
