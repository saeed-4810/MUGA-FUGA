import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { ArtistCombobox, type ArtistOption } from "../components/ArtistCombobox";
import {
  DialogComposition,
  FieldGroup,
  PageSurface,
  StatusBanner,
  WizardSteps,
} from "../components/Composition";
import { PageHeader } from "../components/PageHeader";
import { RequireAuth } from "../components/RequireAuth";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
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
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestName, setRequestName] = useState<string | null>(null);
  const [requestedPending, setRequestedPending] = useState(false);

  const steps = [
    {
      id: "details",
      label: t("products:create.wizard.details.label"),
      description: t("products:create.wizard.details.description"),
      state: name.trim() ? "complete" : "active",
    },
    {
      id: "artist",
      label: t("products:create.wizard.artist.label"),
      description: t("products:create.wizard.artist.description"),
      state: artist ? "complete" : name.trim() ? "active" : "pending",
    },
    {
      id: "cover",
      label: t("products:create.wizard.cover.label"),
      description: t("products:create.wizard.cover.description"),
      state: file ? "complete" : artist ? "active" : "pending",
    },
    {
      id: "review",
      label: t("products:create.wizard.review.label"),
      description: t("products:create.wizard.review.description"),
      state: name.trim() && artist && file ? "active" : "pending",
    },
  ] as const;

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
      setError(
        "code" in e
          ? t("products:create.errors.submitFailedWithCode", { code: e.code })
          : t("products:create.errors.submitFailed")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const requestArtist = async (artistName: string) => {
    setSubmitting(true);
    setRequestError(null);
    try {
      const created = await api.post<ArtistOption>("/artists", { name: artistName });
      setArtist(created);
      setRequestedPending(created.status === "pending");
      setRequestName(null);
    } catch (err) {
      const e = err as ApiError | Error;
      setRequestError(
        "code" in e
          ? t("artists:request.errors.failedWithCode", { code: e.code })
          : t("artists:request.errors.failed")
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <RequireAuth>
      <PageSurface className="space-y-6">
        <PageHeader
          title={t("products:create.title")}
          description={t("products:create.subtitle")}
        />
        <WizardSteps label={t("products:create.wizard.label")} steps={steps} />
        <form
          aria-busy={submitting}
          className="grid gap-6 lg:grid-cols-[1fr_22rem]"
          noValidate
          onSubmit={submit}
        >
          <Card>
            <CardHeader>
              <CardTitle>{t("products:create.formTitle")}</CardTitle>
              <CardDescription>{t("products:create.formDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <FieldGroup
                description={t("products:create.groups.details.description")}
                title={t("products:create.groups.details.title")}
              >
                <div className="space-y-2">
                  <Label htmlFor="name">{t("products:create.fields.name")}</Label>
                  <Input
                    autoComplete="off"
                    id="name"
                    maxLength={120}
                    onChange={(e) => setName(e.target.value)}
                    required
                    value={name}
                  />
                </div>
              </FieldGroup>

              <FieldGroup
                description={t("products:create.groups.artist.description")}
                title={t("products:create.groups.artist.title")}
              >
                <ArtistCombobox
                  disabled={submitting}
                  onChange={(next) => {
                    setArtist(next);
                    setRequestedPending(next?.status === "pending");
                  }}
                  onRequestNew={setRequestName}
                  value={artist}
                />
                {requestedPending && (
                  <StatusBanner tone="warning">
                    {t("artists:productBanner.bothPending")}
                  </StatusBanner>
                )}
              </FieldGroup>

              <FieldGroup
                description={t("products:create.groups.cover.description")}
                title={t("products:create.groups.cover.title")}
              >
                <div className="space-y-2">
                  <Label htmlFor="cover">{t("products:create.fields.coverArt")}</Label>
                  <Input
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="file:bg-primary file:text-primary-foreground file:mr-4 file:rounded-lg file:border-0 file:px-3 file:py-2"
                    id="cover"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                    required
                    type="file"
                  />
                  <p className="text-muted-foreground text-xs">
                    {t("products:create.fields.coverHint")}
                  </p>
                </div>
                {preview && (
                  <img
                    alt={t("products:create.previewAlt")}
                    className="border-border h-40 w-40 rounded-xl border object-cover shadow-sm"
                    src={preview}
                  />
                )}
              </FieldGroup>

              {error && (
                <StatusBanner role="alert" tone="danger">
                  {error}
                </StatusBanner>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button onClick={() => navigate("/products")} type="button" variant="ghost">
                  {t("products:create.actions.cancel")}
                </Button>
                <Button aria-busy={submitting} disabled={submitting} type="submit">
                  {submitting
                    ? t("products:create.actions.submitting")
                    : t("products:create.actions.submit")}
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/40 h-fit">
            <CardHeader>
              <CardTitle className="text-xl">{t("products:create.review.title")}</CardTitle>
              <CardDescription>{t("products:create.review.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t("products:create.fields.name")}</p>
                <p className="text-foreground font-medium">
                  {name.trim() || t("products:create.review.emptyName")}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("products:create.fields.artist")}</p>
                <p className="text-foreground font-medium">
                  {artist?.name ?? t("products:create.review.emptyArtist")}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("products:create.fields.coverArt")}</p>
                <p className="text-foreground font-medium">
                  {file?.name ?? t("products:create.review.emptyCover")}
                </p>
              </div>
            </CardContent>
          </Card>
        </form>
      </PageSurface>
      <Dialog open={requestName !== null} onOpenChange={(open) => !open && setRequestName(null)}>
        <DialogContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (requestName) void requestArtist(requestName);
            }}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>{t("artists:request.title")}</DialogTitle>
              <DialogDescription>{t("artists:request.body")}</DialogDescription>
            </DialogHeader>
            <DialogComposition
              actions={
                <>
                  <Button onClick={() => setRequestName(null)} type="button" variant="ghost">
                    {t("products:create.actions.cancel")}
                  </Button>
                  <Button
                    aria-busy={submitting}
                    disabled={submitting || !requestName?.trim()}
                    type="submit"
                  >
                    {t("artists:request.actions.submit")}
                  </Button>
                </>
              }
              description={t("artists:request.body")}
              title={t("artists:request.title")}
            >
              <div className="space-y-2">
                <Label htmlFor="artist-request-name">{t("artists:combobox.label")}</Label>
                <Input
                  autoFocus
                  id="artist-request-name"
                  maxLength={120}
                  onChange={(event) => setRequestName(event.target.value)}
                  value={requestName ?? ""}
                />
                {requestError && (
                  <StatusBanner role="alert" tone="danger">
                    {requestError}
                  </StatusBanner>
                )}
              </div>
            </DialogComposition>
          </form>
        </DialogContent>
      </Dialog>
    </RequireAuth>
  );
};
