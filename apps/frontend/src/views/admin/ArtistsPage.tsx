"use client";

import { useTranslation } from "react-i18next";

import { EmptyState, ErrorState, LoadingSkeleton, PageSurface } from "../../components/Composition";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/ui/button";
import {
  ArtistEditorDialog,
  ArtistStatusFilter,
  ArtistsTable,
  DeleteArtistDialog,
  formatArtistDate,
  getArtistEmptyCopy,
  RejectArtistDialog,
  useAdminArtists,
  type Artist,
  type ArtistsPageProps,
} from "../../features/admin/artists";

export type { Artist };

export const ArtistsPage = (props: ArtistsPageProps = {}) => {
  const { t } = useTranslation("admin");
  const artists = useAdminArtists(props);
  const emptyCopy = getArtistEmptyCopy(artists.status, t);

  return (
    <PageSurface>
      <PageHeader
        title={t("artists.title")}
        description={t("artists.subtitle")}
        action={
          <Button type="button" onClick={artists.openCreateEditor}>
            {t("artists.actions.create")}
          </Button>
        }
      />

      <ArtistStatusFilter status={artists.status} onStatusChange={artists.setStatus} />

      {artists.error ? (
        <ErrorState className="mb-4">
          {artists.error.code}: {artists.error.message}
        </ErrorState>
      ) : null}
      {!artists.items && !artists.error ? (
        <LoadingSkeleton label={t("artists.title")} shape="row" />
      ) : null}
      {artists.items && artists.items.length === 0 ? (
        <EmptyState description={emptyCopy.body} title={emptyCopy.title} />
      ) : null}
      {artists.items && artists.items.length > 0 ? (
        <ArtistsTable
          formatCreatedAt={formatArtistDate}
          items={artists.items}
          onApprove={(id) => void artists.approve(id)}
          onDelete={artists.openDeleteDialog}
          onEdit={artists.openEditEditor}
          onReject={artists.openRejectDialog}
        />
      ) : null}

      {artists.editing ? (
        <ArtistEditorDialog
          artist={artists.editing === "new" ? undefined : artists.editing}
          onClose={artists.closeEditor}
          onSaved={artists.load}
        />
      ) : null}
      {artists.deleting ? (
        <DeleteArtistDialog
          artist={artists.deleting}
          block={artists.deleteBlock}
          onClose={artists.closeDeleteDialog}
          onConfirm={() => void artists.confirmDelete()}
        />
      ) : null}
      <RejectArtistDialog
        artist={artists.rejecting}
        onClose={artists.closeRejectDialog}
        onConfirm={(artist) => void artists.reject(artist)}
        reason={artists.rejectReason}
        setReason={artists.setRejectReason}
      />
    </PageSurface>
  );
};
