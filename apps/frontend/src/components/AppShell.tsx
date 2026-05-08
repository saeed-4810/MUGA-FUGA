"use client";

import { useState, type ReactNode } from "react";

import { MobileNavigation, Sidebar, TopBar } from "@/features/shell";

export const AppShell = ({
  children,
  initialPendingReviewCount = 0,
}: {
  children: ReactNode;
  initialPendingReviewCount?: number;
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="bg-background text-foreground flex min-h-screen">
      <Sidebar pendingReviewCount={initialPendingReviewCount} />
      <MobileNavigation
        onClose={() => setMobileOpen(false)}
        open={mobileOpen}
        pendingReviewCount={initialPendingReviewCount}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenMenu={() => setMobileOpen(true)} />
        <main className="animate-fade-in flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
};
