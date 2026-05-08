import "../src/styles/index.css";
import "react-easy-crop/react-easy-crop.css";

import type { Metadata } from "next";
import { type ReactNode } from "react";

import { getServerLocale } from "@/lib/server/locale";
import { getServerTheme, getServerThemeClass } from "@/lib/server/theme";
import { THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme-bootstrap";

export const metadata: Metadata = {
  title: "MUGA",
  description: "Music product management system",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [locale, theme] = await Promise.all([getServerLocale(), getServerTheme()]);
  const themeClassName = getServerThemeClass(theme);

  return (
    <html className={themeClassName} lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_BOOTSTRAP_SCRIPT,
          }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
