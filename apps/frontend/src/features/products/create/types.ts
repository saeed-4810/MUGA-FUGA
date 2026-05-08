import type { ArtistOption } from "@/components/ArtistCombobox";

export interface CreateProductPageProps {
  initialArtistOptions?: ArtistOption[];
}

export type WizardStepId = "details" | "artist" | "cover" | "review";

export type StepState = "active" | "complete" | "pending";

export interface WizardStep {
  id: WizardStepId;
  label: string;
  description: string;
  state: StepState;
}
