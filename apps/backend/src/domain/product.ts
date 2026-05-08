import { z } from "zod";

export const ProductStatus = z.enum(["pending", "published", "rejected"]);
export type ProductStatus = z.infer<typeof ProductStatus>;

export const ProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  artistId: z.string().min(1),
  coverArtPath: z.string().min(1),
  coverArtUrl: z.string().url().optional(),
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

export const CreateProductInput = z.object({
  name: z.string().min(1).max(120),
  artistId: z.string().min(1),
  coverArtPath: z.string().min(1),
});
export type CreateProductInput = z.infer<typeof CreateProductInput>;

export const UpdateProductInput = CreateProductInput.partial();
export type UpdateProductInput = z.infer<typeof UpdateProductInput>;
