import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "../../components/PageHeader";
import { RequireAuth } from "../../components/RequireAuth";
import { api, type ApiError } from "../../lib/api";

type ArtistStatus = "pending" | "published" | "rejected";

interface Artist {
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

interface SignedUploadResponse {
  uploadUrl: string;
  objectPath: string;
  expiresAt: string;
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

const uploadArtistImage = async (file: File): Promise<string> => {
  const signed = await api.post<SignedUploadResponse>("/artists/signed-upload", {
    contentType: file.type,
    fileSize: file.size,
  });
  const res = await fetch(signed.uploadUrl, {
    method: "PUT",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!res.ok) throw new Error(String(res.status));
  return signed.objectPath;
};

const trapEdgeTabs = (
  event: React.KeyboardEvent,
  first: HTMLElement | null,
  last: HTMLElement | null
) => {
  if (event.key !== "Tab" || !first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};

const trapContainerTabs = (event: React.KeyboardEvent, container: HTMLElement | null) => {
  if (event.key !== "Tab" || !container) return;
  const focusable = Array.from(
    container.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled]), input, textarea, select"
    )
  );
  trapEdgeTabs(event, focusable[0]!, focusable[focusable.length - 1]!);
};

const StatusPill = ({ status }: { status: ArtistStatus }) => {
  const { t } = useTranslation("admin");
  const tone = {
    pending: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-200",
    published: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
    rejected: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-200",
  }[status];
  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${tone}`}>
      {t(`artists.status.${status}`)}
    </span>
  );
};

interface ArtistEditorProps {
  artist: Artist | undefined;
  onClose: () => void;
  onSaved: () => void;
}

const ArtistEditor = ({ artist, onClose, onSaved }: ArtistEditorProps) => {
  const { t } = useTranslation("admin");
  const titleId = useId();
  const [form, setForm] = useState<ArtistFormState>(() => toFormState(artist));
  const [preview, setPreview] = useState<string | null>(artist?.imageUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const setField = (field: keyof ArtistFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setPreview(URL.createObjectURL(file));
    try {
      const imageObjectPath = await uploadArtistImage(file);
      setForm((current) => ({ ...current, imageObjectPath }));
    } catch (err) {
      setError(
        err instanceof Error && /^\d+$/.test(err.message)
          ? t("artists.editor.errors.uploadStatus", { status: err.message })
          : t("artists.editor.errors.upload")
      );
    }
  };

  const closeOnEscape = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") onClose();
    trapEdgeTabs(event, closeRef.current, saveRef.current);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
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
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" role="presentation">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={closeOnEscape}
        onSubmit={submit}
        className="bg-surface text-ink border-line h-full w-full max-w-xl overflow-y-auto border-l p-6 shadow-2xl"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-xl font-bold">
              {artist ? t("artists.editor.editTitle") : t("artists.editor.createTitle")}
            </h2>
            <p className="text-ink-muted mt-1 text-sm">{t("artists.editor.subtitle")}</p>
          </div>
          <button ref={closeRef} type="button" className="btn-ghost h-9" onClick={onClose}>
            {t("artists.editor.actions.close")}
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="artist-name" className="label">
              {t("artists.editor.fields.name")}
            </label>
            <input
              id="artist-name"
              className="input"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              required
              minLength={1}
              maxLength={120}
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="artist-bio" className="label">
              {t("artists.editor.fields.bio")}
            </label>
            <textarea
              id="artist-bio"
              className="input min-h-32"
              value={form.bio}
              onChange={(e) => setField("bio", e.target.value)}
              maxLength={2000}
            />
          </div>
          <div>
            <label htmlFor="artist-country" className="label">
              {t("artists.editor.fields.country")}
            </label>
            <input
              id="artist-country"
              className="input uppercase"
              value={form.country}
              onChange={(e) => setField("country", e.target.value.toUpperCase())}
              maxLength={2}
              pattern="[A-Za-z]{2}"
              autoComplete="country"
            />
            <p className="text-ink-subtle mt-1 text-xs">{t("artists.editor.fields.countryHint")}</p>
          </div>
          <div>
            <label htmlFor="artist-image" className="label">
              {t("artists.editor.fields.image")}
            </label>
            <input
              id="artist-image"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="input file:bg-brand-500 file:mr-4 file:rounded-lg file:border-0 file:px-3 file:py-2 file:text-white"
              onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
            />
            {preview ? (
              <img
                src={preview}
                alt={t("artists.editor.previewAlt")}
                className="border-line mt-3 h-28 w-28 rounded-xl border object-cover"
              />
            ) : null}
          </div>
          {error ? (
            <div
              role="alert"
              className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm"
            >
              {error}
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost h-10" onClick={onClose}>
            {t("artists.editor.actions.cancel")}
          </button>
          <button ref={saveRef} type="submit" className="btn-primary h-10" disabled={submitting}>
            {submitting ? t("artists.editor.actions.saving") : t("artists.editor.actions.save")}
          </button>
        </div>
      </form>
    </div>
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
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          trapContainerTabs(event, dialogRef.current);
        }}
        ref={dialogRef}
        className="card w-full max-w-lg p-6"
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
                <a className="btn-ghost h-8" href={`/products?productId=${encodeURIComponent(id)}`}>
                  {t("artists.delete.reassign")}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        {block?.hasMore ? (
          <p className="text-ink-subtle mt-2 text-xs">{t("artists.delete.hasMore")}</p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button ref={cancelRef} type="button" className="btn-ghost h-10" onClick={onClose}>
            {t("artists.delete.cancel")}
          </button>
          {!block ? (
            <button ref={confirmRef} type="button" className="btn-primary h-10" onClick={onConfirm}>
              {t("artists.delete.confirm")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export const ArtistsPage = () => {
  const { t } = useTranslation(["admin", "products"]);
  const [status, setStatus] = useState<ArtistStatus>("published");
  const [items, setItems] = useState<Artist[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [editing, setEditing] = useState<Artist | "new" | null>(null);
  const [deleting, setDeleting] = useState<Artist | null>(null);
  const [deleteBlock, setDeleteBlock] = useState<DeleteBlockDetails | undefined>();

  const load = useCallback(() => {
    setItems(null);
    setError(null);
    api
      .get<{ items: Artist[] }>(`/artists?status=${status}`)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e as ApiError));
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const emptyCopy = useMemo(
    () => ({ title: t(`artists.empty.${status}.title`), body: t(`artists.empty.${status}.body`) }),
    [status, t]
  );

  const approve = async (id: string) => {
    await api.post(`/artists/${id}/approve`, {});
    load();
  };

  const reject = async (id: string) => {
    const reason = window.prompt(t("reject.promptReason")) ?? undefined;
    await api.post(`/artists/${id}/reject`, reason ? { reason } : {});
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
    <RequireAuth role="admin">
      <PageHeader
        title={t("artists.title")}
        description={t("artists.subtitle")}
        action={
          <button type="button" className="btn-primary h-10" onClick={() => setEditing("new")}>
            {t("artists.actions.create")}
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label htmlFor="artist-status" className="label mb-0">
          {t("artists.filters.status")}
        </label>
        <select
          id="artist-status"
          className="input max-w-56"
          value={status}
          onChange={(e) => setStatus(e.target.value as ArtistStatus)}
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {t(`artists.status.${s}`)}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div role="alert" className="card mb-4 border-red-500/40 bg-red-500/10 p-4 text-sm">
          {error.code}: {error.message}
        </div>
      ) : null}
      {!items && !error ? <div className="card h-32 animate-pulse" aria-busy="true" /> : null}
      {items && items.length === 0 ? (
        <div className="card p-10 text-center">
          <h2 className="text-lg font-semibold">{emptyCopy.title}</h2>
          <p className="text-ink-muted mt-2 text-sm">{emptyCopy.body}</p>
        </div>
      ) : null}
      {items && items.length > 0 ? (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-ink-subtle text-left text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">{t("artists.columns.artist")}</th>
                <th className="px-4 py-3">{t("artists.columns.country")}</th>
                <th className="px-4 py-3">{t("artists.columns.status")}</th>
                <th className="px-4 py-3">{t("artists.columns.owner")}</th>
                <th className="px-4 py-3">{t("artists.columns.created")}</th>
                <th className="px-4 py-3 text-right">{t("artists.columns.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {items.map((artist) => (
                <tr key={artist.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 font-medium">
                      {artist.imageUrl ? (
                        <img
                          src={artist.imageUrl}
                          alt={t("artists.imageAlt", { name: artist.name })}
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="bg-surface-muted text-ink-subtle grid h-10 w-10 place-items-center rounded-lg">
                          {artist.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <span>{artist.name}</span>
                    </div>
                  </td>
                  <td className="text-ink-muted px-4 py-3">
                    {artist.country ?? t("artists.noCountry")}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={artist.status} />
                  </td>
                  <td className="text-ink-muted px-4 py-3">{artist.ownerEmail}</td>
                  <td className="text-ink-subtle px-4 py-3">
                    {new Date(artist.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {artist.status === "pending" ? (
                        <>
                          <button
                            className="btn-ghost h-8"
                            aria-label={t("artists.actions.rejectNamed", { name: artist.name })}
                            onClick={() => void reject(artist.id)}
                          >
                            {t("queue.actions.reject")}
                          </button>
                          <button
                            className="btn-primary h-8"
                            aria-label={t("artists.actions.approveNamed", { name: artist.name })}
                            onClick={() => void approve(artist.id)}
                          >
                            {t("queue.actions.approve")}
                          </button>
                        </>
                      ) : null}
                      <button
                        className="btn-ghost h-8"
                        aria-label={t("artists.actions.editNamed", { name: artist.name })}
                        onClick={() => setEditing(artist)}
                      >
                        {t("artists.actions.edit")}
                      </button>
                      <button
                        className="btn-ghost h-8 text-red-600 dark:text-red-300"
                        aria-label={t("artists.actions.deleteNamed", { name: artist.name })}
                        onClick={() => {
                          setDeleting(artist);
                          setDeleteBlock(undefined);
                        }}
                      >
                        {t("artists.actions.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    </RequireAuth>
  );
};
