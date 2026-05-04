import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

export const NotFoundPage = () => {
  const { t } = useTranslation("common");
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="card max-w-md p-8 text-center">
        <div className="font-display text-4xl font-bold">404</div>
        <h1 className="mt-2 text-lg font-semibold">{t("notFound.title")}</h1>
        <p className="text-ink-muted mt-2 text-sm">{t("notFound.body")}</p>
        <Link to="/" className="btn-primary mt-4 inline-flex">
          {t("notFound.cta")}
        </Link>
      </div>
    </div>
  );
};
