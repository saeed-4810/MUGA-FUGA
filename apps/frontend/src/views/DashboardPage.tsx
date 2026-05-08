"use client";

import { useTranslation } from "react-i18next";

import { LoadingSkeleton, PageSurface, StatusPill } from "../components/Composition";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { useAuth } from "../context/AuthContext";

export interface ArtistRequest {
  id: string;
  name: string;
  status: "pending" | "published" | "rejected";
}

interface DashboardPageProps {
  initialRequests?: ArtistRequest[] | null;
}

export const DashboardPage = ({ initialRequests = null }: DashboardPageProps = {}) => {
  const { t } = useTranslation(["common", "artists"]);
  const { user } = useAuth();
  const requests = initialRequests;

  if (!user) {
    return (
      <PageSurface>
        <PageHeader
          title={t("dashboard.welcomeAnonymous")}
          description={t("dashboard.signedOutBody")}
        />
        <Button asChild size="lg">
          <a href="/login">{t("nav.signIn")}</a>
        </Button>
      </PageSurface>
    );
  }

  const cards = [
    {
      href: "/products/new",
      kicker: t("dashboard.cards.create.kicker"),
      title: t("dashboard.cards.create.title"),
      body: t("dashboard.cards.create.body"),
    },
    {
      href: "/products",
      kicker: t("dashboard.cards.browse.kicker"),
      title: t("dashboard.cards.browse.title"),
      body: t("dashboard.cards.browse.body"),
    },
    ...(user.role === "admin"
      ? [
          {
            href: "/admin/queue",
            kicker: t("dashboard.cards.queue.kicker"),
            title: t("dashboard.cards.queue.title"),
            body: t("dashboard.cards.queue.body"),
          },
        ]
      : []),
  ];

  return (
    <PageSurface>
      <PageHeader
        title={t("dashboard.welcomeBack", { name: user.displayName ?? user.email })}
        description={t("dashboard.tagline")}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <a
            key={card.href}
            href={card.href}
            className="focus-visible:ring-ring hover:shadow-glow focus-visible:ring-offset-background rounded-2xl outline-none transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <Card className="h-full overflow-hidden">
              <CardHeader>
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.18em]">
                  {card.kicker}
                </p>
                <CardTitle>{card.title}</CardTitle>
                <CardDescription>{card.body}</CardDescription>
              </CardHeader>
            </Card>
          </a>
        ))}
      </div>
      {user.role !== "admin" && (
        <Card className="mt-6" aria-labelledby="pending-requests-title">
          <CardHeader>
            <CardTitle id="pending-requests-title" className="text-lg">
              {t("artists:dashboard.pendingTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!requests && (
              <LoadingSkeleton label={t("artists:dashboard.pendingTitle")} shape="row" />
            )}
            {requests && requests.length === 0 && (
              <p className="text-muted-foreground text-sm">{t("artists:dashboard.pendingEmpty")}</p>
            )}
            {requests && requests.length > 0 && (
              <ul className="divide-border divide-y">
                {requests.map((artist) => (
                  <li
                    key={artist.id}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <span className="font-medium">{artist.name}</span>
                    <StatusPill tone={artist.status}>
                      {t(`artists:status.${artist.status}`)}
                    </StatusPill>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </PageSurface>
  );
};
