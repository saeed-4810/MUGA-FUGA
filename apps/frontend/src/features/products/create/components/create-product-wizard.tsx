import type { TFunction } from "i18next";
import { Loader2 } from "lucide-react";

import { STEP_ORDER } from "../constants";
import type { useCreateProductWizard } from "../hooks/use-create-product-wizard";

import { CoverPreview, SummaryChecklistItem, SummaryItem } from "./summary";

import { ArtistCombobox } from "@/components/ArtistCombobox";
import type { ArtistOption } from "@/components/ArtistCombobox";
import { StatusBanner } from "@/components/Composition";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { navigateTo } from "@/lib/navigation";

interface CreateProductWizardProps {
  initialArtistOptions: ArtistOption[];
  t: TFunction<["products", "artists"]>;
  wizard: ReturnType<typeof useCreateProductWizard>;
}

export const CreateProductWizard = ({
  initialArtistOptions,
  t,
  wizard,
}: CreateProductWizardProps) => {
  const activeStepMeta = wizard.steps[wizard.activeStepIndex]!;
  return (
    <form
      aria-busy={wizard.submitting}
      className={
        wizard.activeStep === "review" ? "grid gap-6" : "grid gap-6 lg:grid-cols-[1fr_22rem]"
      }
      noValidate
      onSubmit={wizard.submit}
    >
      <Card className="overflow-visible">
        <CardHeader className="border-border/80 bg-muted/30 border-b">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.18em]">
            {t("products:create.wizard.progress", {
              current: wizard.activeStepIndex + 1,
              total: STEP_ORDER.length,
            })}
          </p>
          <CardTitle>{activeStepMeta.label}</CardTitle>
          <CardDescription>{activeStepMeta.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-4 sm:p-6">
          {wizard.activeStep === "details" && <ProductDetailsStep t={t} wizard={wizard} />}
          {wizard.activeStep === "artist" && (
            <ArtistStep initialArtistOptions={initialArtistOptions} t={t} wizard={wizard} />
          )}
          {wizard.activeStep === "cover" && <CoverStep t={t} wizard={wizard} />}
          {wizard.activeStep === "review" && <ReviewStep t={t} wizard={wizard} />}
          {wizard.error && (
            <StatusBanner role="alert" tone="danger">
              {wizard.error}
            </StatusBanner>
          )}
          <WizardActions t={t} wizard={wizard} />
        </CardContent>
      </Card>
      {wizard.activeStep !== "review" && <SubmissionSummary t={t} wizard={wizard} />}
    </form>
  );
};

const ProductDetailsStep = ({
  t,
  wizard,
}: {
  t: TFunction<["products", "artists"]>;
  wizard: ReturnType<typeof useCreateProductWizard>;
}) => (
  <div className="space-y-2 pt-1">
    <Label htmlFor="name">{t("products:create.fields.name")}</Label>
    <Input
      autoComplete="off"
      id="name"
      maxLength={120}
      onChange={(event) => wizard.setName(event.target.value)}
      required
      value={wizard.name}
    />
  </div>
);

const ArtistStep = ({
  initialArtistOptions,
  t,
  wizard,
}: {
  initialArtistOptions: ArtistOption[];
  t: TFunction<["products", "artists"]>;
  wizard: ReturnType<typeof useCreateProductWizard>;
}) => (
  <div className="space-y-4">
    <ArtistCombobox
      disabled={wizard.submitting}
      initialItems={initialArtistOptions}
      initialItemsLoaded
      onChange={wizard.setSelectedArtist}
      onRequestNew={wizard.setRequestName}
      value={wizard.artist}
    />
    {wizard.requestedPending && (
      <StatusBanner tone="warning">{t("artists:productBanner.pendingBlocked")}</StatusBanner>
    )}
  </div>
);

const CoverStep = ({
  t,
  wizard,
}: {
  t: TFunction<["products", "artists"]>;
  wizard: ReturnType<typeof useCreateProductWizard>;
}) => (
  <div className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-[8rem_1fr] sm:items-center">
      <CoverPreview preview={wizard.cover.preview} alt={t("products:create.previewAlt")} />
      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="cover">{t("products:create.fields.coverArt")}</Label>
          <p className="text-muted-foreground text-sm" id="cover-hint">
            {t("products:create.fields.coverHint")}
          </p>
        </div>
        <Input
          accept="image/jpeg,image/png,image/webp,image/avif"
          aria-describedby="cover-hint"
          className="file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 h-auto min-h-11 cursor-pointer py-1.5 text-sm file:mr-3 file:max-w-[45%] file:whitespace-nowrap file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium file:transition-colors sm:file:max-w-none"
          id="cover"
          onChange={(event) => wizard.cover.handleFile(event.target.files?.[0] ?? null)}
          required
          type="file"
        />
        <p className="text-muted-foreground truncate text-xs">
          {wizard.cover.file?.name ?? t("products:create.review.emptyCover")}
        </p>
      </div>
    </div>
  </div>
);

const ReviewStep = ({
  t,
  wizard,
}: {
  t: TFunction<["products", "artists"]>;
  wizard: ReturnType<typeof useCreateProductWizard>;
}) => (
  <div className="grid gap-6 lg:grid-cols-[10rem_1fr] lg:items-start">
    <CoverPreview preview={wizard.cover.preview} alt={t("products:create.previewAlt")} />
    <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
      <SummaryItem label={t("products:create.fields.name")} value={wizard.name.trim()} />
      <SummaryItem label={t("products:create.fields.artist")} value={wizard.artist!.name} />
      <SummaryItem label={t("products:create.fields.coverArt")} value={wizard.cover.file!.name} />
    </div>
  </div>
);

const WizardActions = ({
  t,
  wizard,
}: {
  t: TFunction<["products", "artists"]>;
  wizard: ReturnType<typeof useCreateProductWizard>;
}) => (
  <div className="border-border/80 flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:items-center sm:justify-end">
    <Button onClick={() => navigateTo("/products")} type="button" variant="ghost">
      {t("products:create.actions.cancel")}
    </Button>
    {wizard.activeStep !== "details" && (
      <Button disabled={wizard.submitting} onClick={wizard.goBack} type="button" variant="outline">
        {t("products:create.actions.back")}
      </Button>
    )}
    {wizard.activeStep !== "review" ? (
      <Button disabled={wizard.submitting} type="submit">
        {t("products:create.actions.next")}
      </Button>
    ) : (
      <Button
        aria-busy={wizard.submitting}
        disabled={wizard.submitting || !wizard.isReadyToSubmit}
        type="submit"
      >
        {wizard.submitting ? (
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
);

const SubmissionSummary = ({
  t,
  wizard,
}: {
  t: TFunction<["products", "artists"]>;
  wizard: ReturnType<typeof useCreateProductWizard>;
}) => (
  <Card className="bg-muted/30 h-fit overflow-hidden lg:sticky lg:top-6">
    <CardHeader className="border-border/80 bg-muted/30 border-b">
      <CardTitle className="text-xl">{t("products:create.review.title")}</CardTitle>
      <CardDescription>{t("products:create.review.description")}</CardDescription>
    </CardHeader>
    <CardContent className="mb-2 space-y-5 text-sm">
      <SummaryChecklistItem
        complete={wizard.isDetailsComplete}
        label={t("products:create.fields.name")}
        value={wizard.name.trim() || t("products:create.review.emptyName")}
      />
      <SummaryChecklistItem
        complete={wizard.isArtistComplete}
        label={t("products:create.fields.artist")}
        value={wizard.artist?.name ?? t("products:create.review.emptyArtist")}
      />
      <SummaryChecklistItem
        complete={wizard.isCoverComplete}
        label={t("products:create.fields.coverArt")}
        value={wizard.cover.file?.name ?? t("products:create.review.emptyCover")}
      />
    </CardContent>
  </Card>
);
