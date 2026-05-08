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
