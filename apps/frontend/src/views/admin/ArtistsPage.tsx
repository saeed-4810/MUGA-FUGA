"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  MediaThumbnail,
  PageSurface,
  StatusBanner,
  StatusPill,
} from "../../components/Composition";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import { api, type ApiError } from "../../lib/api";
import { uploadArtistImage } from "../../lib/uploads";

type ArtistStatus = "pending" | "published" | "rejected";

export interface Artist {
  id: string;
  name: string;
  bio?: string;
  country?: string;
  imageUrl?: string;
  imageObjectPath?: string;
  status: ArtistStatus;
  ownerEmail: string;
  createdAt: string;
}

interface ArtistFormState {
  name: string;
  bio: string;
  country: string;
  imageObjectPath?: string;
}

interface DeleteBlockDetails {
  blockingProductIds?: string[];
  hasMore?: boolean;
}

const statusOptions: ArtistStatus[] = ["published", "pending", "rejected"];

const toFormState = (artist?: Artist): ArtistFormState => ({
  name: artist?.name ?? "",
  bio: artist?.bio ?? "",
  country: artist?.country ?? "",
  ...(artist?.imageObjectPath ? { imageObjectPath: artist.imageObjectPath } : {}),
});

const buildPayload = (form: ArtistFormState) => ({
  name: form.name.trim(),
  ...(form.bio.trim() ? { bio: form.bio.trim() } : {}),
  ...(form.country.trim() ? { country: form.country.trim().toUpperCase() } : {}),
  ...(form.imageObjectPath ? { imageObjectPath: form.imageObjectPath } : {}),
});

const isDeleteBlockDetails = (details: unknown): details is DeleteBlockDetails => {
  if (!details || typeof details !== "object") return false;
  const value = details as Record<string, unknown>;
  return value.blockingProductIds === undefined || Array.isArray(value.blockingProductIds);
};

const trapContainerTabs = (event: React.KeyboardEvent, container: HTMLElement | null) => {
  if (event.key !== "Tab" || !container) return;
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), input, textarea, select"
    )
  );
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

interface ArtistEditorProps {
  artist: Artist | undefined;
  onClose: () => void;
  onSaved: () => void;
}

const ArtistEditor = ({ artist, onClose, onSaved }: ArtistEditorProps) => {
  const { t } = useTranslation("admin");
  const [form, setForm] = useState<ArtistFormState>(() => toFormState(artist));
  const [preview, setPreview] = useState<string | null>(artist?.imageUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const setField = (field: keyof ArtistFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setPreview(URL.createObjectURL(file));
    setImageUploading(true);
    try {
      const imageObjectPath = await uploadArtistImage(file);
      setForm((current) => ({ ...current, imageObjectPath }));
    } catch (err) {
      setError(
        err instanceof Error && /status (\d+)/i.test(err.message)
          ? t("artists.editor.errors.uploadStatus", {
              status: err.message.match(/status (\d+)/i)?.[1],
            })
          : t("artists.editor.errors.upload")
      );
    } finally {
      setImageUploading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (imageUploading) {
      setError(t("artists.editor.errors.uploadInProgress"));
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload(form);
      if (artist) await api.patch<Artist>(`/artists/${artist.id}`, payload);
      else await api.post<Artist>("/artists", payload);
      onSaved();
      onClose();
    } catch (err) {
      const e = err as ApiError | Error;
      setError("code" in e ? `${e.code}: ${e.message}` : e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <form aria-busy={submitting} onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {artist ? t("artists.editor.editTitle") : t("artists.editor.createTitle")}
            </DialogTitle>
            <DialogDescription>{t("artists.editor.subtitle")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-5 lg:grid-cols-[9rem_1fr]">
            <div className="space-y-3">
              <MediaThumbnail
                alt={t("artists.editor.previewAlt")}
                className="h-32 w-32 rounded-2xl"
                fallbackLabel={form.name.slice(0, 1).toUpperCase() || "♪"}
                {...(preview ? { src: preview } : {})}
              />
              <p className="text-muted-foreground text-xs">
                {t("artists.editor.fields.imageHint")}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="artist-name">{t("artists.editor.fields.name")}</Label>
                <Input
                  autoComplete="off"
                  id="artist-name"
                  maxLength={120}
                  minLength={1}
                  onChange={(e) => setField("name", e.target.value)}
                  required
                  value={form.name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="artist-bio">{t("artists.editor.fields.bio")}</Label>
                <textarea
                  id="artist-bio"
                  className="border-input bg-background text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-32 w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                  maxLength={2000}
                  onChange={(e) => setField("bio", e.target.value)}
                  value={form.bio}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
                <div className="space-y-2">
                  <Label htmlFor="artist-country">{t("artists.editor.fields.country")}</Label>
                  <Input
                    autoComplete="country"
                    className="uppercase"
                    id="artist-country"
                    maxLength={2}
                    onChange={(e) => setField("country", e.target.value.toUpperCase())}
                    pattern="[A-Za-z]{2}"
                    value={form.country}
                  />
                  <p className="text-muted-foreground text-xs">
                    {t("artists.editor.fields.countryHint")}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="artist-image">{t("artists.editor.fields.image")}</Label>
                  <Input
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 h-auto min-h-10 cursor-pointer py-1.5 text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium file:transition-colors"
                    disabled={imageUploading || submitting}
                    id="artist-image"
                    onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
                    type="file"
                  />
                  <p className="text-muted-foreground text-xs">
                    {imageUploading
                      ? t("artists.editor.actions.uploading")
                      : (form.imageObjectPath ?? t("artists.editor.fields.noImage"))}
                  </p>
                </div>
              </div>
              {error ? (
                <StatusBanner role="alert" tone="danger">
                  {error}
                </StatusBanner>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("artists.editor.actions.cancel")}
            </Button>
            <Button type="submit" disabled={submitting || imageUploading}>
              {imageUploading
                ? t("artists.editor.actions.uploading")
                : submitting
                  ? t("artists.editor.actions.saving")
                  : t("artists.editor.actions.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

interface DeleteDialogProps {
  artist: Artist;
  block: DeleteBlockDetails | undefined;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteDialog = ({ artist, block, onClose, onConfirm }: DeleteDialogProps) => {
  const { t } = useTranslation("admin");
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const ids = block?.blockingProductIds ?? [];

  useEffect(() => {
    cancelRef.current?.focus();
  }, [block]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          trapContainerTabs(event, dialogRef.current);
        }}
        ref={dialogRef}
        className="w-full max-w-lg p-6"
      >
        <h2 id={titleId} className="text-xl font-bold">
          {block ? t("artists.delete.blockedTitle") : t("artists.delete.title")}
        </h2>
        <p className="text-ink-muted mt-2 text-sm">
          {block
            ? t("artists.delete.blockedBody", { count: ids.length })
            : t("artists.delete.body", { name: artist.name })}
        </p>
        {ids.length > 0 ? (
          <ul className="divide-line border-line mt-4 divide-y rounded-xl border">
            {ids.map((id) => (
              <li key={id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span>{id}</span>
                <Button asChild size="sm" variant="ghost">
                  <a href={`/products?productId=${encodeURIComponent(id)}`}>
                    {t("artists.delete.reassign")}
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {block?.hasMore ? (
          <p className="text-ink-subtle mt-2 text-xs">{t("artists.delete.hasMore")}</p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <Button ref={cancelRef} type="button" variant="outline" onClick={onClose}>
            {t("artists.delete.cancel")}
          </Button>
          {!block ? (
            <Button ref={confirmRef} type="button" onClick={onConfirm}>
              {t("artists.delete.confirm")}
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
};

interface ArtistsPageProps {
  initialError?: ApiError | null;
  initialItems?: Artist[] | null;
  initialStatus?: ArtistStatus;
}

export const ArtistsPage = ({
  initialError = null,
  initialItems = null,
  initialStatus = "published",
}: ArtistsPageProps = {}) => {
  const { t } = useTranslation(["admin", "products"]);
  const [status, setStatus] = useState<ArtistStatus>(initialStatus);
  const [items, setItems] = useState<Artist[] | null>(initialItems);
  const [error, setError] = useState<ApiError | null>(initialError);
  const [editing, setEditing] = useState<Artist | "new" | null>(null);
  const [deleting, setDeleting] = useState<Artist | null>(null);
  const [rejecting, setRejecting] = useState<Artist | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [deleteBlock, setDeleteBlock] = useState<DeleteBlockDetails | undefined>();
  const didSkipInitialStatusLoad = useRef(false);

  const load = useCallback(() => {
    setItems(null);
    setError(null);
    api
      .get<{ items: Artist[] }>(`/artists?status=${status}`)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e as ApiError));
  }, [status]);

  useEffect(() => {
    if (!didSkipInitialStatusLoad.current && status === initialStatus) {
      didSkipInitialStatusLoad.current = true;
      return;
    }
    load();
  }, [initialStatus, load, status]);

  const emptyCopy = useMemo(
    () => ({ title: t(`artists.empty.${status}.title`), body: t(`artists.empty.${status}.body`) }),
    [status, t]
  );

  const approve = async (id: string) => {
    await api.post(`/artists/${id}/approve`, {});
    load();
  };

  const reject = async (artist: Artist) => {
    const reason = rejectReason.trim();
    await api.post(`/artists/${artist.id}/reject`, reason ? { reason } : {});
    setRejecting(null);
    setRejectReason("");
    load();
  };

  const confirmDelete = async () => {
    try {
      await api.delete(`/artists/${deleting!.id}`);
      setDeleting(null);
      setDeleteBlock(undefined);
      load();
    } catch (err) {
      const e = err as ApiError;
      if (e.status === 409 && isDeleteBlockDetails(e.details)) {
        setDeleteBlock(e.details);
        return;
      }
      setError(e);
      setDeleting(null);
    }
  };

  return (
    <PageSurface>
      <PageHeader
        title={t("artists.title")}
        description={t("artists.subtitle")}
        action={
          <Button type="button" onClick={() => setEditing("new")}>
            {t("artists.actions.create")}
          </Button>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <Label htmlFor="artist-status" className="mb-0">
          {t("artists.filters.status")}
        </Label>
        <select
          id="artist-status"
          className="border-input bg-background text-foreground ring-offset-background focus-visible:ring-ring h-10 max-w-56 rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          value={status}
          onChange={(e) => setStatus(e.target.value as ArtistStatus)}
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {t(`artists.status.${s}`)}
            </option>
          ))}
        </select>
      </Card>

      {error ? (
        <ErrorState className="mb-4">
          {error.code}: {error.message}
        </ErrorState>
      ) : null}
      {!items && !error ? <LoadingSkeleton label={t("artists.title")} shape="row" /> : null}
      {items && items.length === 0 ? (
        <EmptyState description={emptyCopy.body} title={emptyCopy.title} />
      ) : null}
      {items && items.length > 0 ? (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/60">
              <TableRow>
                <TableHead>{t("artists.columns.artist")}</TableHead>
                <TableHead>{t("artists.columns.country")}</TableHead>
                <TableHead>{t("artists.columns.status")}</TableHead>
                <TableHead>{t("artists.columns.owner")}</TableHead>
                <TableHead>{t("artists.columns.created")}</TableHead>
                <TableHead className="text-right">{t("artists.columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((artist) => (
                <TableRow key={artist.id}>
                  <TableCell>
                    <div className="flex items-center gap-3 font-medium">
                      <MediaThumbnail
                        alt={t("artists.imageAlt", { name: artist.name })}
                        className="h-10 w-10 rounded-lg"
                        fallbackLabel={artist.name.slice(0, 1).toUpperCase()}
                        {...(artist.imageUrl ? { src: artist.imageUrl } : {})}
                      />
                      <span>{artist.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {artist.country ?? t("artists.noCountry")}
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={artist.status}>
                      {t(`artists.status.${artist.status}`)}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{artist.ownerEmail}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(artist.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {artist.status === "pending" ? (
                        <>
                          <Button
                            aria-label={t("artists.actions.rejectNamed", { name: artist.name })}
                            onClick={() => {
                              setRejecting(artist);
                              setRejectReason("");
                            }}
                            size="sm"
                            variant="outline"
                          >
                            {t("queue.actions.reject")}
                          </Button>
                          <Button
                            aria-label={t("artists.actions.approveNamed", { name: artist.name })}
                            onClick={() => void approve(artist.id)}
                            size="sm"
                          >
                            {t("queue.actions.approve")}
                          </Button>
                        </>
                      ) : null}
                      <Button
                        aria-label={t("artists.actions.editNamed", { name: artist.name })}
                        onClick={() => setEditing(artist)}
                        size="sm"
                        variant="outline"
                      >
                        {t("artists.actions.edit")}
                      </Button>
                      <Button
                        aria-label={t("artists.actions.deleteNamed", { name: artist.name })}
                        onClick={() => {
                          setDeleting(artist);
                          setDeleteBlock(undefined);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        {t("artists.actions.delete")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}

      {editing ? (
        <ArtistEditor
          artist={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={load}
        />
      ) : null}
      {deleting ? (
        <DeleteDialog
          artist={deleting}
          block={deleteBlock}
          onClose={() => {
            setDeleting(null);
            setDeleteBlock(undefined);
          }}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("artists.reject.title", { name: rejecting?.name ?? "" })}</DialogTitle>
            <DialogDescription>{t("artists.reject.body")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="artist-reject-reason">{t("artists.reject.reason")}</Label>
            <Input
              id="artist-reject-reason"
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder={t("artists.reject.placeholder")}
              value={rejectReason}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejecting(null)}>
              {t("artists.reject.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => rejecting && void reject(rejecting)}
            >
              {t("artists.reject.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageSurface>
  );
};
