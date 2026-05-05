import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

interface ArtistRequest {
  id: string;
  name: string;
  status: "pending" | "published" | "rejected";
}

export const DashboardPage = () => {
  const { t } = useTranslation(["common", "artists"]);
  const { user } = useAuth();
  const [requests, setRequests] = useState<ArtistRequest[] | null>(null);

  useEffect(() => {
    if (!user || user.role === "admin") return;
    api
      .get<{ items: ArtistRequest[] }>(
        `/artists?ownerUid=${encodeURIComponent(user.uid)}&status=pending,rejected`
      )
      .then((res) => setRequests(res.items))
      .catch(() => setRequests([]));
  }, [user]);

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
      {user.role !== "admin" && (
        <section className="card mt-6 p-5" aria-labelledby="pending-requests-title">
          <h2 id="pending-requests-title" className="text-lg font-semibold">
            {t("artists:dashboard.pendingTitle")}
          </h2>
          {!requests && (
            <div className="bg-surface-muted mt-4 h-16 animate-pulse rounded-xl" aria-busy="true" />
          )}
          {requests && requests.length === 0 && (
            <p className="text-ink-muted mt-2 text-sm">{t("artists:dashboard.pendingEmpty")}</p>
          )}
          {requests && requests.length > 0 && (
            <ul className="divide-line mt-3 divide-y">
              {requests.map((artist) => (
                <li key={artist.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="font-medium">{artist.name}</span>
                  <span className="text-ink-subtle uppercase tracking-wider">
                    {t(`artists:status.${artist.status}`)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};
