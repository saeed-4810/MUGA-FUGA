import { Loader2 } from "lucide-react";
import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

import { ArtistCombobox, type ArtistOption } from "../components/ArtistCombobox";
import {
  DialogComposition,
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
import { Slider } from "../components/ui/slider";
import { api, type ApiError } from "../lib/api";
import { getCroppedImageFile, type PixelCrop } from "../lib/imageCrop";
import { uploadCoverArt } from "../lib/uploads";

type WizardStepId = "details" | "artist" | "cover" | "review";

const stepOrder: WizardStepId[] = ["details", "artist", "cover", "review"];

const CreateProductContent = () => {
  const { t } = useTranslation(["products", "artists"]);
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState<WizardStepId>("details");
  const [name, setName] = useState("");
  const [artist, setArtist] = useState<ArtistOption | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<PixelCrop | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestName, setRequestName] = useState<string | null>(null);
  const [requestedPending, setRequestedPending] = useState(false);

  const isDetailsComplete = name.trim().length > 0;
  const isArtistComplete = Boolean(artist);
  const isArtistPublished = artist?.status === "published";
  const isCoverComplete = Boolean(file);
  const isReadyToSubmit = isDetailsComplete && isArtistPublished && isCoverComplete;
  const activeStepIndex = stepOrder.indexOf(activeStep);

  const steps = [
    {
      id: "details",
      label: t("products:create.wizard.details.label"),
      description: t("products:create.wizard.details.description"),
      state: activeStep === "details" ? "active" : "complete",
    },
    {
      id: "artist",
      label: t("products:create.wizard.artist.label"),
      description: t("products:create.wizard.artist.description"),
      state: activeStep === "artist" ? "active" : activeStepIndex > 1 ? "complete" : "pending",
    },
    {
      id: "cover",
      label: t("products:create.wizard.cover.label"),
      description: t("products:create.wizard.cover.description"),
      state: activeStep === "cover" ? "active" : activeStepIndex > 2 ? "complete" : "pending",
    },
    {
      id: "review",
      label: t("products:create.wizard.review.label"),
      description: t("products:create.wizard.review.description"),
      state: activeStep === "review" ? "active" : "pending",
    },
  ] as const;

  const activeStepMeta = steps[activeStepIndex]!;

  const handleFile = (f: File | null) => {
    if (!f) {
      setFile(null);
      setPreview(null);
      return;
    }
    setPendingFile(f);
    setPendingPreview(URL.createObjectURL(f));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setCroppedAreaPixels(null);
    setCropDialogOpen(true);
  };

  const resetCrop = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  const applyCrop = async () => {
    const cropSourceFile = pendingFile!;
    const cropSourcePreview = pendingPreview!;
    try {
      const croppedFile = croppedAreaPixels
        ? await getCroppedImageFile({
            crop: croppedAreaPixels,
            fileName: cropSourceFile.name,
            imageSrc: cropSourcePreview,
            rotation,
          })
        : cropSourceFile;
      setFile(croppedFile);
      setPreview(URL.createObjectURL(croppedFile));
    } catch {
      setFile(cropSourceFile);
      setPreview(cropSourcePreview);
    } finally {
      setCropDialogOpen(false);
    }
  };

  const validateStep = (step: WizardStepId): boolean => {
    setError(null);
    if (step === "details" && !isDetailsComplete) {
      setError(t("products:create.errors.nameRequired"));
      return false;
    }
    if (step === "artist" && !isArtistComplete) {
      setError(t("products:create.errors.artistRequired"));
      return false;
    }
    if (step === "artist" && !isArtistPublished) {
      setError(t("artists:productBanner.pendingBlocked"));
      return false;
    }
    if (step === "cover" && !isCoverComplete) {
      setError(t("products:create.errors.coverRequired"));
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep(activeStep)) return;
    const index = stepOrder.indexOf(activeStep);
    setActiveStep(stepOrder[Math.min(index + 1, stepOrder.length - 1)]!);
  };

  const goBack = () => {
    setError(null);
    const index = stepOrder.indexOf(activeStep);
    setActiveStep(stepOrder[Math.max(index - 1, 0)]!);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeStep !== "review") {
      goNext();
      return;
    }
    setSubmitting(true);
    try {
      const objectPath = await uploadCoverArt(file!);
      await api.post("/products", { name, artistId: artist!.id, coverArtPath: objectPath });
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
    <>
      <PageSurface className="space-y-6">
        <PageHeader
          title={t("products:create.title")}
          description={t("products:create.subtitle")}
        />
        <WizardSteps label={t("products:create.wizard.label")} steps={steps} />
        <form
          aria-busy={submitting}
          className={activeStep === "review" ? "grid gap-6" : "grid gap-6 lg:grid-cols-[1fr_22rem]"}
          noValidate
          onSubmit={submit}
        >
          <Card className="overflow-visible">
            <CardHeader className="border-border/80 bg-muted/30 border-b">
              <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.18em]">
                {t("products:create.wizard.progress", {
                  current: activeStepIndex + 1,
                  total: stepOrder.length,
                })}
              </p>
              <CardTitle>{activeStepMeta.label}</CardTitle>
              <CardDescription>{activeStepMeta.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 p-4 sm:p-6">
              {activeStep === "details" && (
                <div className="space-y-4 pt-1">
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
                </div>
              )}

              {activeStep === "artist" && (
                <div className="space-y-4">
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
                      {t("artists:productBanner.pendingBlocked")}
                    </StatusBanner>
                  )}
                </div>
              )}

              {activeStep === "cover" && (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-[8rem_1fr] sm:items-center">
                    <div className="bg-muted shadow-soft grid aspect-square place-items-center overflow-hidden rounded-xl">
                      {preview && (
                        <img
                          alt={t("products:create.previewAlt")}
                          className="h-full w-full object-cover"
                          src={preview}
                        />
                      )}
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="cover">{t("products:create.fields.coverArt")}</Label>
                        <p className="text-muted-foreground text-sm" id="cover-hint">
                          {t("products:create.fields.coverHint")}
                        </p>
                      </div>
                      <Input
                        aria-describedby="cover-hint"
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        className="file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 h-auto min-h-11 cursor-pointer py-1.5 text-sm file:mr-3 file:max-w-[45%] file:whitespace-nowrap file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium file:transition-colors sm:file:max-w-none"
                        id="cover"
                        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                        required
                        type="file"
                      />
                      <p className="text-muted-foreground truncate text-xs">
                        {file?.name ?? t("products:create.review.emptyCover")}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeStep === "review" && (
                <div className="space-y-4">
                  <div className="grid gap-6 lg:grid-cols-[10rem_1fr] lg:items-start">
                    <div className="bg-muted shadow-soft grid aspect-square place-items-center overflow-hidden rounded-xl">
                      {preview && (
                        <img
                          alt={t("products:create.previewAlt")}
                          className="h-full w-full object-cover"
                          src={preview}
                        />
                      )}
                    </div>
                    <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
                      <SummaryItem label={t("products:create.fields.name")} value={name.trim()} />
                      <SummaryItem
                        label={t("products:create.fields.artist")}
                        value={artist!.name}
                      />
                      <SummaryItem
                        label={t("products:create.fields.coverArt")}
                        value={file!.name}
                      />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <StatusBanner role="alert" tone="danger">
                  {error}
                </StatusBanner>
              )}

              <div className="border-border/80 flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:items-center sm:justify-end">
                <Button onClick={() => navigate("/products")} type="button" variant="ghost">
                  {t("products:create.actions.cancel")}
                </Button>
                {activeStep !== "details" && (
                  <Button disabled={submitting} onClick={goBack} type="button" variant="outline">
                    {t("products:create.actions.back")}
                  </Button>
                )}
                {activeStep !== "review" ? (
                  <Button disabled={submitting} type="submit">
                    {t("products:create.actions.next")}
                  </Button>
                ) : (
                  <Button
                    aria-busy={submitting}
                    disabled={submitting || !isReadyToSubmit}
                    type="submit"
                  >
                    {submitting ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                        {t("products:create.actions.submitting")}
                      </span>
                    ) : (
                      t("products:create.actions.submit")
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          {activeStep !== "review" && (
            <Card className="bg-muted/30 h-fit overflow-hidden lg:sticky lg:top-6">
              <CardHeader className="border-border/80 bg-muted/30 border-b">
                <CardTitle className="text-xl">{t("products:create.review.title")}</CardTitle>
                <CardDescription>{t("products:create.review.description")}</CardDescription>
              </CardHeader>
              <CardContent className="mb-2 space-y-5 text-sm">
                <SummaryChecklistItem
                  complete={isDetailsComplete}
                  label={t("products:create.fields.name")}
                  value={name.trim() || t("products:create.review.emptyName")}
                />
                <SummaryChecklistItem
                  complete={isArtistComplete}
                  label={t("products:create.fields.artist")}
                  value={artist?.name ?? t("products:create.review.emptyArtist")}
                />
                <SummaryChecklistItem
                  complete={isCoverComplete}
                  label={t("products:create.fields.coverArt")}
                  value={file?.name ?? t("products:create.review.emptyCover")}
                />
              </CardContent>
            </Card>
          )}
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
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("products:create.crop.title")}</DialogTitle>
            <DialogDescription>{t("products:create.crop.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="bg-muted relative h-72 overflow-hidden rounded-xl sm:h-96">
              {pendingPreview && (
                <Cropper
                  image={pendingPreview}
                  crop={crop}
                  zoom={zoom}
                  rotation={rotation}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onRotationChange={setRotation}
                  onCropComplete={(_area: Area, areaPixels: Area) =>
                    setCroppedAreaPixels(areaPixels)
                  }
                />
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cover-zoom">{t("products:create.crop.zoom")}</Label>
                <Slider
                  id="cover-zoom"
                  min={1}
                  max={3}
                  step={0.1}
                  value={[zoom]}
                  onValueChange={([value]) => setZoom(value!)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cover-rotation">{t("products:create.crop.rotation")}</Label>
                <Slider
                  id="cover-rotation"
                  min={0}
                  max={360}
                  step={1}
                  value={[rotation]}
                  onValueChange={([value]) => setRotation(value!)}
                />
              </div>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button onClick={() => setCropDialogOpen(false)} type="button" variant="ghost">
                {t("products:create.actions.cancel")}
              </Button>
              <Button onClick={resetCrop} type="button" variant="outline">
                {t("products:create.crop.reset")}
              </Button>
              <Button onClick={() => void applyCrop()} type="button">
                {t("products:create.crop.apply")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const SummaryItem = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">{label}</p>
    <p className="text-foreground mt-1 font-medium">{value}</p>
  </div>
);

const SummaryChecklistItem = ({
  complete,
  label,
  value,
}: {
  complete: boolean;
  label: string;
  value: string;
}) => (
  <div className="mt-5 min-w-0">
    <p
      className={
        complete
          ? "text-primary text-xs font-semibold uppercase tracking-wide"
          : "text-muted-foreground text-xs font-semibold uppercase tracking-wide"
      }
    >
      {label}
    </p>
    <p className="text-foreground mt-1 truncate font-medium">{value}</p>
  </div>
);

export const CreateProductPage = () => (
  <RequireAuth>
    <CreateProductContent />
  </RequireAuth>
);
