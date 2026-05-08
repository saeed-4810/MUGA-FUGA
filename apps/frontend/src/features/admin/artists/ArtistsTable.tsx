import { useTranslation } from "react-i18next";

import type { Artist } from "./types";

import { MediaThumbnail, StatusPill } from "@/components/Composition";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ArtistsTableProps {
  formatCreatedAt: (value: string) => string;
  items: Artist[];
  onApprove: (id: string) => void;
  onDelete: (artist: Artist) => void;
  onEdit: (artist: Artist) => void;
  onReject: (artist: Artist) => void;
}

export const ArtistsTable = ({
  formatCreatedAt,
  items,
  onApprove,
  onDelete,
  onEdit,
  onReject,
}: ArtistsTableProps) => {
  const { t } = useTranslation(["admin", "products"]);

  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/60">
          <TableRow>
            <TableHead>{t("admin:artists.columns.artist")}</TableHead>
            <TableHead>{t("admin:artists.columns.country")}</TableHead>
            <TableHead>{t("admin:artists.columns.status")}</TableHead>
            <TableHead>{t("admin:artists.columns.owner")}</TableHead>
            <TableHead>{t("admin:artists.columns.created")}</TableHead>
            <TableHead className="text-right">{t("admin:artists.columns.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((artist) => (
            <TableRow key={artist.id}>
              <TableCell>
                <div className="flex items-center gap-3 font-medium">
                  <MediaThumbnail
                    alt={t("admin:artists.imageAlt", { name: artist.name })}
                    className="h-10 w-10 rounded-lg"
                    fallbackLabel={artist.name.slice(0, 1).toUpperCase()}
                    {...(artist.imageUrl ? { src: artist.imageUrl } : {})}
                  />
                  <span>{artist.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {artist.country ?? t("admin:artists.noCountry")}
              </TableCell>
              <TableCell>
                <StatusPill tone={artist.status}>
                  {t(`admin:artists.status.${artist.status}`)}
                </StatusPill>
              </TableCell>
              <TableCell className="text-muted-foreground">{artist.ownerEmail}</TableCell>
              <TableCell className="text-muted-foreground">
                {formatCreatedAt(artist.createdAt)}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap justify-end gap-2">
                  {artist.status === "pending" ? (
                    <>
                      <Button
                        aria-label={t("admin:artists.actions.rejectNamed", { name: artist.name })}
                        onClick={() => onReject(artist)}
                        size="sm"
                        variant="outline"
                      >
                        {t("admin:queue.actions.reject")}
                      </Button>
                      <Button
                        aria-label={t("admin:artists.actions.approveNamed", { name: artist.name })}
                        onClick={() => onApprove(artist.id)}
                        size="sm"
                      >
                        {t("admin:queue.actions.approve")}
                      </Button>
                    </>
                  ) : null}
                  <Button
                    aria-label={t("admin:artists.actions.editNamed", { name: artist.name })}
                    onClick={() => onEdit(artist)}
                    size="sm"
                    variant="outline"
                  >
                    {t("admin:artists.actions.edit")}
                  </Button>
                  <Button
                    aria-label={t("admin:artists.actions.deleteNamed", { name: artist.name })}
                    onClick={() => onDelete(artist)}
                    size="sm"
                    variant="outline"
                  >
                    {t("admin:artists.actions.delete")}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};
