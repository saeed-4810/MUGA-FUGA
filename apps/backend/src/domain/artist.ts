import { z } from "zod";

/**
 * Domain model: Artist (band, solo act, label-managed brand).
 *
 * Persisted in Firestore collection `artists`. Same `pending → published |
 * rejected` lifecycle as products. ADR-007 §Schema and §Routes are the
 * canonical reference.
 *
 * Two derived fields support uniqueness:
 *   - `name_lc` — `name.trim().toLowerCase()`. Used by the create/update
 *     transaction to enforce case-insensitive uniqueness across the
 *     `published` + `pending` populations.
 *   - `slug` — `slugify(name)` (lowercase, kebab, ASCII-fold). Useful for
 *     pretty URLs and a separate uniqueness gate.
 *
 * `name_lc` and `slug` are **not** in `CreateArtistInput` — the route
 * derives them server-side, so a malicious client can't forge a slug
 * collision.
 */

export const ArtistStatus = z.enum(["pending", "published", "rejected"]);
export type ArtistStatus = z.infer<typeof ArtistStatus>;

/**
 * ISO 3166-1 alpha-2 country code. Permissive (accepts any 2-letter code)
 * to avoid bundling a country list and bumping bundle size; the frontend
 * select is the authoritative allowlist.
 */
const CountryCode = z.string().regex(/^[A-Z]{2}$/, "Country must be an ISO 3166-1 alpha-2 code");

export const ArtistSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  // Case-insensitive lookup field. Always derived from `name`; never trusted
  // from the client.
  name_lc: z.string().min(1).max(120),
  // URL-safe slug derived from `name`. Always derived; never trusted from
  // the client.
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

/**
 * Derive the `name_lc` shadow field. Pure; safe to call inline at write time.
 */
export const deriveNameLc = (name: string): string => name.trim().toLowerCase();

/**
 * Derive a URL-safe kebab slug from a display name.
 *
 *   "Aurora ✨ Borealis"  → "aurora-borealis"
 *   "  Múzika  "          → "muzika"
 *   "!@#$%^"               → "" → fallback "artist"
 *
 * The fallback exists so a name made entirely of emoji or punctuation
 * still yields a non-empty slug; the route then disambiguates on the
 * uniqueness check (which would 409 anyway because two such artists
 * would land on the same fallback).
 */
export const slugify = (name: string): string => {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
  return slug || "artist";
};
