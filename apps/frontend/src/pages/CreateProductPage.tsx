import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { ArtistCombobox, type ArtistOption } from "../components/ArtistCombobox";
import { PageHeader } from "../components/PageHeader";
import { RequireAuth } from "../components/RequireAuth";
import { api, type ApiError } from "../lib/api";
import { uploadCoverArt } from "../lib/uploads";

export const CreateProductPage = () => {
  const { t } = useTranslation(["products", "artists"]);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [artist, setArtist] = useState<ArtistOption | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestName, setRequestName] = useState<string | null>(null);
  const [requestedPending, setRequestedPending] = useState(false);

  const handleFile = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError(t("products:create.errors.coverRequired"));
      return;
    }
    if (!artist) {
      setError(t("products:create.errors.artistRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const objectPath = await uploadCoverArt(file);
      await api.post("/products", { name, artistId: artist.id, coverArtPath: objectPath });
      navigate("/products");
    } catch (err) {
      const e = err as ApiError | Error;
      setError("code" in e ? `${e.code}: ${e.message}` : e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const requestArtist = async (artistName: string) => {
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<ArtistOption>("/artists", { name: artistName });
      setArtist(created);
      setRequestedPending(created.status === "pending");
      setRequestName(null);
    } catch (err) {
      const e = err as ApiError | Error;
      setError("code" in e ? `${e.code}: ${e.message}` : e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RequireAuth>
      <PageHeader title={t("products:create.title")} description={t("products:create.subtitle")} />
      <form onSubmit={submit} className="card mx-auto max-w-xl space-y-4 p-6" noValidate>
        <div>
          <label htmlFor="name" className="label">
            {t("products:create.fields.name")}
          </label>
          <input
            id="name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={120}
            autoComplete="off"
          />
        </div>
        <ArtistCombobox
          value={artist}
          disabled={submitting}
          onChange={(next) => {
            setArtist(next);
            setRequestedPending(next?.status === "pending");
          }}
          onRequestNew={setRequestName}
        />
        {requestedPending && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
            {t("artists:productBanner.bothPending")}
          </div>
        )}
        <div>
          <label htmlFor="cover" className="label">
            {t("products:create.fields.coverArt")}
          </label>
          <input
            id="cover"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="input file:bg-brand-500 file:mr-4 file:rounded-lg file:border-0 file:px-3 file:py-2 file:text-white"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            required
          />
          {preview && (
            <img
              src={preview}
              alt={t("products:create.previewAlt")}
              className="border-line mt-3 h-40 w-40 rounded-xl border object-cover"
            />
          )}
          <p className="text-ink-subtle mt-1 text-xs">{t("products:create.fields.coverHint")}</p>
        </div>
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm"
          >
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost h-10" onClick={() => navigate("/products")}>
            {t("products:create.actions.cancel")}
          </button>
          <button type="submit" className="btn-primary h-10" disabled={submitting}>
            {submitting
              ? t("products:create.actions.submitting")
              : t("products:create.actions.submit")}
          </button>
        </div>
      </form>
      {requestName && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="artist-request-title"
          className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4"
          onKeyDown={(event) => {
            if (event.key === "Escape") setRequestName(null);
          }}
        >
          <form
            className="card w-full max-w-md space-y-4 p-6"
            onSubmit={(event) => {
              event.preventDefault();
              void requestArtist(requestName);
            }}
          >
            <div>
              <h2 id="artist-request-title" className="text-lg font-semibold">
                {t("artists:request.title")}
              </h2>
              <p className="text-ink-muted mt-1 text-sm">{t("artists:request.body")}</p>
            </div>
            <label htmlFor="artist-request-name" className="label">
              {t("artists:combobox.label")}
            </label>
            <input
              id="artist-request-name"
              className="input"
              value={requestName}
              maxLength={120}
              autoFocus
              onChange={(event) => setRequestName(event.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost h-10" onClick={() => setRequestName(null)}>
                {t("products:create.actions.cancel")}
              </button>
              <button
                type="submit"
                className="btn-primary h-10"
                disabled={submitting || !requestName.trim()}
              >
                {t("artists:request.actions.submit")}
              </button>
            </div>
          </form>
        </div>
      )}
    </RequireAuth>
  );
};
