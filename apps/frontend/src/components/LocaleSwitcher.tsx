import { useTranslation } from "react-i18next";

const SUPPORTED = (import.meta.env.VITE_SUPPORTED_LOCALES ?? "en,nl").split(",");

export const LocaleSwitcher = () => {
  const { i18n, t } = useTranslation("common");
  const current = (i18n.resolvedLanguage ?? "en").slice(0, 2);
  return (
    <label className="relative">
      <span className="sr-only">{t("locale.label")}</span>
      <select
        aria-label={t("locale.label")}
        className="input h-9 w-20 cursor-pointer pr-7 text-sm"
        value={current}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
        data-testid="locale-switcher"
      >
        {SUPPORTED.map((code) => (
          <option key={code} value={code}>
            {code.toUpperCase()}
          </option>
        ))}
      </select>
    </label>
  );
};
