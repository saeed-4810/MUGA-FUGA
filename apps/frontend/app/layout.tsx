import "../src/styles/index.css";
import "react-easy-crop/react-easy-crop.css";

import type { Metadata } from "next";
import { type ReactNode } from "react";

import { getServerLocale } from "../src/lib/server/locale";
import { getServerTheme, getServerThemeClass } from "../src/lib/server/theme";

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
            __html:
              "(()=>{try{const t=localStorage.getItem('muga.theme')||document.cookie.match(/(?:^|; )muga\\.theme=([^;]+)/)?.[1]||'system';const d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);document.documentElement.style.colorScheme=d?'dark':'light'}catch{}})();",
          }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
