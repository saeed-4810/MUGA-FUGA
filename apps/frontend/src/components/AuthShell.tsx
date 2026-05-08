"use client";

import "../i18n";

import type { ReactNode } from "react";

import { AuthProvider, type MugaUser } from "../context/AuthContext";
import { ThemeProvider, type Theme } from "../context/ThemeContext";
import { setInitialLanguage } from "../i18n";

export const AuthShell = ({
  children,
  initialUser = null,
  initialLocale = "en",
  initialTheme = "system",
}: {
  children: ReactNode;
  initialUser?: MugaUser | null;
  initialLocale?: string;
  initialTheme?: Theme;
}) => {
  setInitialLanguage(initialLocale);

  return (
    <ThemeProvider initialTheme={initialTheme}>
      <AuthProvider initialUser={initialUser}>{children}</AuthProvider>
    </ThemeProvider>
  );
};
