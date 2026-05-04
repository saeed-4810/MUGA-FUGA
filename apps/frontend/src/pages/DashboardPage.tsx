import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";

export const DashboardPage = () => {
  const { t } = useTranslation("common");
  const { user } = useAuth();

  if (!user) {
    return (
      <div>
        <PageHeader
          title={t("dashboard.welcomeAnonymous")}
          description={t("dashboard.signedOutBody")}
        />
        <Link to="/login" className="btn-primary h-11">
          {t("nav.signIn")}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t("dashboard.welcomeBack", { name: user.displayName ?? user.email })}
        description={t("dashboard.tagline")}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link to="/products/new" className="card hover:shadow-glow p-5 transition">
          <div className="text-ink-muted text-sm font-medium">
            {t("dashboard.cards.create.kicker")}
          </div>
          <div className="mt-1 text-lg font-semibold">{t("dashboard.cards.create.title")}</div>
          <p className="text-ink-muted mt-2 text-sm">{t("dashboard.cards.create.body")}</p>
        </Link>
        <Link to="/products" className="card hover:shadow-glow p-5 transition">
          <div className="text-ink-muted text-sm font-medium">
            {t("dashboard.cards.browse.kicker")}
          </div>
          <div className="mt-1 text-lg font-semibold">{t("dashboard.cards.browse.title")}</div>
          <p className="text-ink-muted mt-2 text-sm">{t("dashboard.cards.browse.body")}</p>
        </Link>
        {user.role === "admin" && (
          <Link to="/admin/queue" className="card hover:shadow-glow p-5 transition">
            <div className="text-ink-muted text-sm font-medium">
              {t("dashboard.cards.queue.kicker")}
            </div>
            <div className="mt-1 text-lg font-semibold">{t("dashboard.cards.queue.title")}</div>
            <p className="text-ink-muted mt-2 text-sm">{t("dashboard.cards.queue.body")}</p>
          </Link>
        )}
      </div>
    </div>
  );
};
