import { useTranslation } from "react-i18next";

import { SUPPORTED_LOCALES } from "../i18n/resources";

const persistLocale = (locale: string): void => {
  document.cookie = `muga.locale=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
};

export const LocaleSwitcher = () => {
  const { i18n, t } = useTranslation("common");
  const current = (i18n.resolvedLanguage ?? "en").slice(0, 2);
  const handleChange = (locale: string) => {
    persistLocale(locale);
    void i18n.changeLanguage(locale);
  };

  return (
    <label className="relative">
      <span className="sr-only">{t("locale.label")}</span>
      <select
        aria-label={t("locale.label")}
        className="input h-9 w-20 cursor-pointer pr-7 text-sm"
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        data-testid="locale-switcher"
      >
        {SUPPORTED_LOCALES.map((code) => (
          <option key={code} value={code}>
            {code.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
};
