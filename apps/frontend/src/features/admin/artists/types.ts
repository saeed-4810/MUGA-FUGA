import type { ApiError } from "@/lib/api";

export type ArtistStatus = "pending" | "published" | "rejected";

export interface Artist {
  id: string;
  name: string;
  bio?: string;
  country?: string;
  imageUrl?: string;
  imageObjectPath?: string;
  status: ArtistStatus;
  ownerEmail: string;
  createdAt: string;
}

export interface ArtistFormState {
  name: string;
  bio: string;
  country: string;
  imageObjectPath?: string;
}

export interface DeleteBlockDetails {
  blockingProductIds?: string[];
  hasMore?: boolean;
}

export interface ArtistsPageProps {
  initialError?: ApiError | null;
  initialItems?: Artist[] | null;
  initialStatus?: ArtistStatus;
}

export type EditingArtist = Artist | "new" | null;
