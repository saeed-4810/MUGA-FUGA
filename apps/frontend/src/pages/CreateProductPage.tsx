import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { PageHeader } from "../components/PageHeader";
import { RequireAuth } from "../components/RequireAuth";
import { api, type ApiError } from "../lib/api";
import { uploadCoverArt } from "../lib/uploads";

export const CreateProductPage = () => {
  const { t } = useTranslation("products");
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (f: File | null) => {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError(t("create.errors.coverRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const objectPath = await uploadCoverArt(file);
      await api.post("/products", { name, artistName, coverArtPath: objectPath });
      navigate("/products");
    } catch (err) {
      const e = err as ApiError | Error;
      setError("code" in e ? `${e.code}: ${e.message}` : e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RequireAuth>
      <PageHeader title={t("create.title")} description={t("create.subtitle")} />
      <form onSubmit={submit} className="card mx-auto max-w-xl space-y-4 p-6" noValidate>
        <div>
          <label htmlFor="name" className="label">
            {t("create.fields.name")}
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
        <div>
          <label htmlFor="artist" className="label">
            {t("create.fields.artistName")}
          </label>
          <input
            id="artist"
            className="input"
            value={artistName}
            onChange={(e) => setArtistName(e.target.value)}
            required
            maxLength={120}
            autoComplete="off"
          />
        </div>
        <div>
          <label htmlFor="cover" className="label">
            {t("create.fields.coverArt")}
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
              alt={t("create.previewAlt")}
              className="border-line mt-3 h-40 w-40 rounded-xl border object-cover"
            />
          )}
          <p className="text-ink-subtle mt-1 text-xs">{t("create.fields.coverHint")}</p>
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
            {t("create.actions.cancel")}
          </button>
          <button type="submit" className="btn-primary h-10" disabled={submitting}>
            {submitting ? t("create.actions.submitting") : t("create.actions.submit")}
          </button>
        </div>
      </form>
    </RequireAuth>
  );
};
