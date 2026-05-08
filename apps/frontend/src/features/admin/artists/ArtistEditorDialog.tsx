import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { buildArtistPayload, toArtistFormState } from "./artist-form";
import type { Artist, ArtistFormState } from "./types";

import { MediaThumbnail, StatusBanner } from "@/components/Composition";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type ApiError } from "@/lib/api";
import { uploadArtistImage } from "@/lib/uploads";

interface ArtistEditorDialogProps {
  artist: Artist | undefined;
  onClose: () => void;
  onSaved: () => void;
}

const toEditorError = (error: unknown) => {
  const apiError = error as ApiError | Error;
  return "code" in apiError ? `${apiError.code}: ${apiError.message}` : apiError.message;
};

export const ArtistEditorDialog = ({ artist, onClose, onSaved }: ArtistEditorDialogProps) => {
  const { t } = useTranslation("admin");
  const [form, setForm] = useState<ArtistFormState>(() => toArtistFormState(artist));
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
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "";
      const status = message.match(/status (\d+)/i)?.[1];
      setError(
        status
          ? t("artists.editor.errors.uploadStatus", { status })
          : t("artists.editor.errors.upload")
      );
    } finally {
      setImageUploading(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (imageUploading) {
      setError(t("artists.editor.errors.uploadInProgress"));
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildArtistPayload(form);
      if (artist) await api.patch<Artist>(`/artists/${artist.id}`, payload);
      else await api.post<Artist>("/artists", payload);
      onSaved();
      onClose();
    } catch (submitError) {
      setError(toEditorError(submitError));
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
                  onChange={(event) => setField("name", event.target.value)}
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
                  onChange={(event) => setField("bio", event.target.value)}
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
                    onChange={(event) => setField("country", event.target.value.toUpperCase())}
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
                    onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
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
