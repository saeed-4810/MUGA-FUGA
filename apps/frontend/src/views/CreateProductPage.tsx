"use client";

import { useTranslation } from "react-i18next";

import { PageSurface, WizardSteps } from "@/components/Composition";
import { PageHeader } from "@/components/PageHeader";
import { ArtistRequestDialog } from "@/features/products/create/components/artist-request-dialog";
import { CoverCropDialog } from "@/features/products/create/components/cover-crop-dialog";
import { CreateProductWizard } from "@/features/products/create/components/create-product-wizard";
import { useCreateProductWizard } from "@/features/products/create/hooks/use-create-product-wizard";
import type { CreateProductPageProps } from "@/features/products/create/types";

export const CreateProductPage = ({ initialArtistOptions = [] }: CreateProductPageProps = {}) => {
  const { t } = useTranslation(["products", "artists"]);
  const wizard = useCreateProductWizard(t);

  return (
    <>
      <PageSurface className="space-y-6">
        <PageHeader
          title={t("products:create.title")}
          description={t("products:create.subtitle")}
        />
        <WizardSteps label={t("products:create.wizard.label")} steps={wizard.steps} />
        <CreateProductWizard initialArtistOptions={initialArtistOptions} t={t} wizard={wizard} />
      </PageSurface>

      <ArtistRequestDialog
        onRequestArtist={wizard.requestArtist}
        requestError={wizard.requestError}
        requestName={wizard.requestName}
        setRequestName={wizard.setRequestName}
        submitting={wizard.submitting}
        t={t}
      />
      <CoverCropDialog cropState={wizard.cover} t={t} />
    </>
  );
};
