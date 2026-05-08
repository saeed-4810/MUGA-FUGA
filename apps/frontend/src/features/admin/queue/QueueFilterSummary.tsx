import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface QueueFilterSummaryProps {
  pendingCount: number;
}

export const QueueFilterSummary = ({ pendingCount }: QueueFilterSummaryProps) => {
  const { t } = useTranslation("admin");

  return (
    <Card className="mb-4">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium">{t("queue.filters.status")}</div>
          <p className="text-muted-foreground text-sm">{t("queue.filters.description")}</p>
        </div>
        <div role="group" aria-label={t("queue.filters.status")}>
          <Button aria-pressed="true" variant="secondary">
            {t("queue.status.pending", { count: pendingCount })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
