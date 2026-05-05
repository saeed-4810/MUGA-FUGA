import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

const supported = (import.meta.env.VITE_SUPPORTED_LOCALES ?? "en,nl").split(",");
const fallback = import.meta.env.VITE_DEFAULT_LOCALE ?? "en";

void i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: fallback,
    supportedLngs: supported,
    nonExplicitSupportedLngs: true,
    ns: ["common", "auth", "products", "admin", "artists", "errors"],
    defaultNS: "common",
    backend: { loadPath: "/locales/{{lng}}/{{ns}}.json" },
    detection: {
      order: ["querystring", "localStorage", "navigator"],
      lookupQuerystring: "lang",
      lookupLocalStorage: "muga.locale",
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

export default i18n;
