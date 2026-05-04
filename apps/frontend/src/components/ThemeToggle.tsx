import { useTranslation } from "react-i18next";

import { useTheme } from "../context/ThemeContext";

export const ThemeToggle = () => {
  const { t } = useTranslation("common");
  const { resolved, toggle } = useTheme();
  const next = resolved === "dark" ? t("theme.light") : t("theme.dark");
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("theme.toggle", { next })}
      className="btn-ghost border-line h-9 w-9 rounded-xl border"
      data-testid="theme-toggle"
    >
      <span aria-hidden="true">{resolved === "dark" ? "☀" : "☾"}</span>
    </button>
  );
};
