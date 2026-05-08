import type { ReactNode } from "react";

import { AppShell } from "../../src/components/AppShell";
import { AuthShell } from "../../src/components/AuthShell";
import { requireServerSession } from "../../src/lib/server/auth";
import { getServerLocale } from "../../src/lib/server/locale";
import { loadPendingReviewCount } from "../../src/lib/server/pending-review";
import { getServerTheme } from "../../src/lib/server/theme";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const [session, locale, theme] = await Promise.all([requireServerSession(), getServerLocale(), getServerTheme()]);
  const pendingReviewCount = await loadPendingReviewCount(
    session.sessionCookie,
    session.user.role === "admin"
  );
  return (
    <AuthShell initialLocale={locale} initialTheme={theme} initialUser={session.user}>
      <AppShell initialPendingReviewCount={pendingReviewCount}>{children}</AppShell>
    </AuthShell>
  );
}
