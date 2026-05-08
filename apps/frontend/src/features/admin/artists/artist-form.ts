import type { Artist, ArtistFormState, DeleteBlockDetails } from "./types";

export const artistStatusOptions = ["published", "pending", "rejected"] as const;

export const toArtistFormState = (artist?: Artist): ArtistFormState => ({
  name: artist?.name ?? "",
  bio: artist?.bio ?? "",
  country: artist?.country ?? "",
  ...(artist?.imageObjectPath ? { imageObjectPath: artist.imageObjectPath } : {}),
});

export const buildArtistPayload = (form: ArtistFormState) => ({
  name: form.name.trim(),
  ...(form.bio.trim() ? { bio: form.bio.trim() } : {}),
  ...(form.country.trim() ? { country: form.country.trim().toUpperCase() } : {}),
  ...(form.imageObjectPath ? { imageObjectPath: form.imageObjectPath } : {}),
});

export const isDeleteBlockDetails = (details: unknown): details is DeleteBlockDetails => {
  if (!details || typeof details !== "object") return false;
  const value = details as Record<string, unknown>;
  return value.blockingProductIds === undefined || Array.isArray(value.blockingProductIds);
};
