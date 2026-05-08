import { cookies } from "next/headers";
import { cache } from "react";

import { DEFAULT_LOCALE, normalizeLocale, type SupportedLocale } from "../../i18n/resources";

export const LOCALE_COOKIE_NAME = "muga.locale";

export const getServerLocale = cache(async (): Promise<SupportedLocale> => {
  const cookieStore = await cookies();
  return normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value ?? DEFAULT_LOCALE);
});
