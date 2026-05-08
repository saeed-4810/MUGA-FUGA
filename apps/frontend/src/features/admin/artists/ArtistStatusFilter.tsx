import { useTranslation } from "react-i18next";

import { artistStatusOptions } from "./artist-form";
import type { ArtistStatus } from "./types";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface ArtistStatusFilterProps {
  status: ArtistStatus;
  onStatusChange: (status: ArtistStatus) => void;
}

export const ArtistStatusFilter = ({ status, onStatusChange }: ArtistStatusFilterProps) => {
  const { t } = useTranslation("admin");

  return (
    <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
      <Label htmlFor="artist-status" className="mb-0">
        {t("artists.filters.status")}
      </Label>
      <select
        id="artist-status"
        className="border-input bg-background text-foreground ring-offset-background focus-visible:ring-ring h-10 max-w-56 rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        value={status}
        onChange={(event) => onStatusChange(event.target.value as ArtistStatus)}
      >
        {artistStatusOptions.map((option) => (
          <option key={option} value={option}>
            {t(`artists.status.${option}`)}
          </option>
        ))}
      </select>
    </Card>
  );
};
