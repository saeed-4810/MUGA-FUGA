"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

import { PageSurface } from "../components/Composition";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

export const NotFoundPage = () => {
  const { t } = useTranslation("common");
  return (
    <PageSurface className="grid min-h-[50vh] place-items-center">
      <Card className="max-w-md p-8 text-center">
        <div className="font-display text-4xl font-bold">404</div>
        <h1 className="mt-2 text-lg font-semibold">{t("notFound.title")}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t("notFound.body")}</p>
        <Button asChild className="mt-4">
          <Link href="/">{t("notFound.cta")}</Link>
        </Button>
      </Card>
    </PageSurface>
  );
};
