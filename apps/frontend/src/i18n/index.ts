import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import {
  DEFAULT_LOCALE,
  I18N_NAMESPACES,
  SUPPORTED_LOCALES,
  normalizeLocale,
  resources,
} from "./resources";

const LOCALE_STORAGE_KEY = "muga.locale";

const getClientPersistedLocale = (): string | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LOCALE_STORAGE_KEY);
};

if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: SUPPORTED_LOCALES,
      nonExplicitSupportedLngs: true,
      ns: I18N_NAMESPACES,
      defaultNS: "common",
      resources,
      detection: {
        order: ["querystring", "cookie", "localStorage", "htmlTag", "navigator"],
        lookupQuerystring: "lang",
        lookupCookie: "muga.locale",
        lookupLocalStorage: "muga.locale",
        // LocaleSwitcher owns persistence. Automatic detector caching runs during
        // hydration and can overwrite a user's saved locale with the SSR fallback
        // before AuthShell has a chance to restore it.
        caches: [],
      },
      initImmediate: false,
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });
}

export const setInitialLanguage = (locale: string | null | undefined): void => {
  const language = normalizeLocale(getClientPersistedLocale() ?? locale);
  if (normalizeLocale(i18n.resolvedLanguage ?? i18n.language) !== language) {
    void i18n.changeLanguage(language);
  }
};

export default i18n;
