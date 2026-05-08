import { cookies } from "next/headers";
import { cache } from "react";

import type { Theme } from "../../context/ThemeContext";

const THEME_COOKIE = "muga.theme";

const isTheme = (value: string | undefined): value is Theme =>
  value === "light" || value === "dark" || value === "system";

export const getServerTheme = cache(async (): Promise<Theme> => {
  const store = await cookies();
  const theme = store.get(THEME_COOKIE)?.value;
  return isTheme(theme) ? theme : "system";
});

export const getServerThemeClass = (theme: Theme): string | undefined =>
  theme === "dark" ? "dark" : undefined;
