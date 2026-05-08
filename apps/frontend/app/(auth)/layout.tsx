import type { ReactNode } from "react";

import { AuthShell } from "../../src/components/AuthShell";
import { getServerSession } from "../../src/lib/server/auth";
import { getServerLocale } from "../../src/lib/server/locale";
import { getServerTheme } from "../../src/lib/server/theme";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const [session, locale, theme] = await Promise.all([getServerSession(), getServerLocale(), getServerTheme()]);
  return <AuthShell initialLocale={locale} initialTheme={theme} initialUser={session?.user ?? null}>{children}</AuthShell>;
}
