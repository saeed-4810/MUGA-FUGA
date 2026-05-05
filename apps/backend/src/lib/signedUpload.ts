/**
 * Shared signed-URL upload helper.
 *
 * Both the products and artists routes need the same signed-URL flow:
 * validate the request, mint a 5-minute Storage URL, return
 * `{ uploadUrl, objectPath, expiresAt }`. The only thing that varies
 * is the bucket prefix.
 *
 * Extracted from `routes/products.ts:25-55` so a single well-tested
 * implementation serves both surfaces. Adding a third uploader (e.g.
 * podcast cover art) later is one constant.
 */
import { z } from "zod";

import type { Env } from "../config/env.js";

import { bucket } from "./firebase.js";

/**
 * Same content-type and size policy as MUGA-3 cover art:
 *   - JPEG / PNG / WebP / AVIF only
 *   - Up to 5 MB
 */
export const SignedUploadInput = z.object({
  contentType: z
    .string()
    .regex(/^image\/(jpeg|png|webp|avif)$/i, "Only JPEG, PNG, WEBP, or AVIF images are allowed"),
  fileSize: z
    .number()
    .int()
    .positive()
    .max(5 * 1024 * 1024, "Maximum image file size is 5 MB"),
});
export type SignedUploadInput = z.infer<typeof SignedUploadInput>;

export interface SignedUploadResult {
  uploadUrl: string;
  objectPath: string;
  expiresAt: string;
}

/**
 * Mint a v4 signed PUT URL for a given storage prefix.
 *
 * @param env       — backend env (drives the Storage SDK)
 * @param prefix    — bucket-relative prefix (e.g. `cover-art`, `artist-images`)
 * @param ownerUid  — uid of the user creating the upload; appears in the
 *                    object path so storage rules can pin "owner-only writes"
 * @param input     — already-parsed `SignedUploadInput`
 */
export const mintSignedUpload = async (
  env: Env,
  prefix: string,
  ownerUid: string,
  input: SignedUploadInput
): Promise<SignedUploadResult> => {
  const objectPath = `${prefix}/${ownerUid}/${Date.now()}-${crypto.randomUUID()}`;
  const file = bucket(env).file(objectPath);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  const [uploadUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: expiresAt,
    contentType: input.contentType,
  });
  return {
    uploadUrl,
    objectPath,
    expiresAt: expiresAt.toISOString(),
  };
};
