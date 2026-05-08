import type { ReactNode } from "react";

import { AppShell } from "@/components/AppShell";
import { AuthShell } from "@/components/AuthShell";
import { requireServerRole } from "@/lib/server/auth";
import { getServerLocale } from "@/lib/server/locale";
import { loadPendingReviewCount } from "@/lib/server/pending-review";
import { getServerTheme } from "@/lib/server/theme";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [session, locale, theme] = await Promise.all([requireServerRole("admin"), getServerLocale(), getServerTheme()]);
  const pendingReviewCount = await loadPendingReviewCount(session.sessionCookie, true);
  return (
    <AuthShell initialLocale={locale} initialTheme={theme} initialUser={session.user}>
      <AppShell initialPendingReviewCount={pendingReviewCount}>{children}</AppShell>
    </AuthShell>
  );
}
