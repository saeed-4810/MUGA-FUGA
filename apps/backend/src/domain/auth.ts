import { z } from "zod";

export const Role = z.enum(["admin", "customer"]);
export type Role = z.infer<typeof Role>;

export const AuthUser = z.object({
  uid: z.string().min(1),
  email: z.string().email(),
  role: Role,
  emailVerified: z.boolean().optional(),
});
export type AuthUser = z.infer<typeof AuthUser>;

// Express Request augmentation lives in `src/types/express.d.ts` using the
// global `Express.Request` interface (the Express-recommended augmentation
// point that works without depending on the resolution of
// `@types/express-serve-static-core`).
