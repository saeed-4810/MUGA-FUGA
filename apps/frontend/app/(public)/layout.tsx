import type { ReactNode } from "react";

import { AuthShell } from "@/components/AuthShell";
import { getServerSession } from "@/lib/server/auth";
import { getServerLocale } from "@/lib/server/locale";
import { getServerTheme } from "@/lib/server/theme";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [session, locale, theme] = await Promise.all([getServerSession(), getServerLocale(), getServerTheme()]);
  return <AuthShell initialLocale={locale} initialTheme={theme} initialUser={session?.user ?? null}>{children}</AuthShell>;
}
