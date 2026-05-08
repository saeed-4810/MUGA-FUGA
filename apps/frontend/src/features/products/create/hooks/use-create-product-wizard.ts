import type { TFunction } from "i18next";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";

import { STEP_ORDER } from "../constants";
import { formatCreateProductError } from "../helpers";
import type { StepState, WizardStepId } from "../types";

import { useCoverArtCrop } from "./use-cover-art-crop";

import type { ArtistOption } from "@/components/ArtistCombobox";
import { api } from "@/lib/api";
import { navigateTo } from "@/lib/navigation";
import { uploadCoverArt } from "@/lib/uploads";

export const useCreateProductWizard = (t: TFunction<["products", "artists"]>) => {
  const cover = useCoverArtCrop();
  const [activeStep, setActiveStep] = useState<WizardStepId>("details");
  const [name, setName] = useState("");
  const [artist, setArtist] = useState<ArtistOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestName, setRequestName] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestedPending, setRequestedPending] = useState(false);

  const activeStepIndex = STEP_ORDER.indexOf(activeStep);
  const isDetailsComplete = name.trim().length > 0;
  const isArtistComplete = Boolean(artist);
  const isArtistPublished = artist?.status === "published";
  const isCoverComplete = Boolean(cover.file);
  const isReadyToSubmit = isDetailsComplete && isArtistPublished && isCoverComplete;

  const steps = useMemo(
    () =>
      STEP_ORDER.map((id, index) => ({
        id,
        label: t(`products:create.wizard.${id}.label`),
        description: t(`products:create.wizard.${id}.description`),
        state: (activeStep === id
          ? "active"
          : index < activeStepIndex
            ? "complete"
            : "pending") as StepState,
      })),
    [activeStep, activeStepIndex, t]
  );

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
    setActiveStep(STEP_ORDER[Math.min(activeStepIndex + 1, STEP_ORDER.length - 1)]!);
  };

  const goBack = () => {
    setError(null);
    setActiveStep(STEP_ORDER[Math.max(activeStepIndex - 1, 0)]!);
  };

  const setSelectedArtist = (next: ArtistOption | null) => {
    setArtist(next);
    setRequestedPending(next?.status === "pending");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (activeStep !== "review") {
      goNext();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const objectPath = await uploadCoverArt(cover.file!);
      await api.post("/products", {
        name: name.trim(),
        artistId: artist!.id,
        coverArtPath: objectPath,
      });
      navigateTo("/products");
    } catch (err) {
      setError(
        formatCreateProductError(err, t("products:create.errors.submitFailed"), (code) =>
          t("products:create.errors.submitFailedWithCode", { code })
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const requestArtist = async (artistName: string) => {
    setSubmitting(true);
    setRequestError(null);
    try {
      const created = await api.post<ArtistOption>("/artists", { name: artistName.trim() });
      setArtist(created);
      setRequestedPending(created.status === "pending");
      setRequestName(null);
    } catch (err) {
      setRequestError(
        formatCreateProductError(err, t("artists:request.errors.failed"), (code) =>
          t("artists:request.errors.failedWithCode", { code })
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  return {
    activeStep,
    activeStepIndex,
    artist,
    cover,
    error,
    goBack,
    isArtistComplete,
    isCoverComplete,
    isDetailsComplete,
    isReadyToSubmit,
    name,
    requestArtist,
    requestError,
    requestName,
    requestedPending,
    setName,
    setRequestName,
    setSelectedArtist,
    steps,
    submit,
    submitting,
  };
};
