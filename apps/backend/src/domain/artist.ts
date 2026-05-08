import { z } from "zod";

export const ArtistStatus = z.enum(["pending", "published", "rejected"]);
export type ArtistStatus = z.infer<typeof ArtistStatus>;

const CountryCode = z.string().regex(/^[A-Z]{2}$/, "Country must be an ISO 3166-1 alpha-2 code");

export const ArtistSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  name_lc: z.string().min(1).max(120),
  slug: z.string().min(1).max(140),
  bio: z.string().max(2000).optional(),
  imageUrl: z.string().url().optional(),
  imageObjectPath: z.string().min(1).optional(),
  country: CountryCode.optional(),
  status: ArtistStatus,
  ownerUid: z.string().min(1),
  ownerEmail: z.string().email(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  approvedAt: z.string().datetime().optional(),
  approvedBy: z.string().optional(),
  rejectionReason: z.string().optional(),
});

export type Artist = z.infer<typeof ArtistSchema>;

export const CreateArtistInput = z.object({
  name: z.string().min(1).max(120),
  bio: z.string().max(2000).optional(),
  country: CountryCode.optional(),
  imageObjectPath: z.string().min(1).optional(),
});
export type CreateArtistInput = z.infer<typeof CreateArtistInput>;

export const UpdateArtistInput = CreateArtistInput.partial();
export type UpdateArtistInput = z.infer<typeof UpdateArtistInput>;

export const deriveNameLc = (name: string): string => name.trim().toLowerCase();

export const slugify = (name: string): string => {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
  return slug || "artist";
};
