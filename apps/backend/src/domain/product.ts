import { z } from "zod";

/**
 * Domain model: Product (album / single / EP).
 * Persisted in Firestore collection `products`.
 */

export const ProductStatus = z.enum(["pending", "published", "rejected"]);
export type ProductStatus = z.infer<typeof ProductStatus>;

export const ProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  artistName: z.string().min(1).max(120),
  coverArtPath: z.string().min(1), // Firebase Storage object path
  coverArtUrl: z.string().url().optional(), // CDN URL (signed or public)
  status: ProductStatus,
  ownerUid: z.string().min(1),
  ownerEmail: z.string().email(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  approvedAt: z.string().datetime().optional(),
  approvedBy: z.string().optional(),
  rejectionReason: z.string().optional(),
});

export type Product = z.infer<typeof ProductSchema>;

// Create input (multipart upload finalised by /products/finalize-upload).
export const CreateProductInput = z.object({
  name: z.string().min(1).max(120),
  artistName: z.string().min(1).max(120),
  coverArtPath: z.string().min(1),
});
export type CreateProductInput = z.infer<typeof CreateProductInput>;

export const UpdateProductInput = CreateProductInput.partial();
export type UpdateProductInput = z.infer<typeof UpdateProductInput>;

// Signed-URL request for cover-art upload.
export const SignedUploadInput = z.object({
  contentType: z
    .string()
    .regex(/^image\/(jpeg|png|webp|avif)$/i, "Only JPEG, PNG, WEBP, or AVIF images are allowed"),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024, "Maximum cover-art file size is 5 MB"),
});
export type SignedUploadInput = z.infer<typeof SignedUploadInput>;

export const SignedUploadResponse = z.object({
  uploadUrl: z.string().url(),
  objectPath: z.string().min(1),
  expiresAt: z.string().datetime(),
});
export type SignedUploadResponse = z.infer<typeof SignedUploadResponse>;
