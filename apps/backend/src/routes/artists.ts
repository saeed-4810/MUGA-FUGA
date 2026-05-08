import { Router, type Router as ExpressRouter } from "express";

import type { Env } from "../config/env.js";
import {
  ArtistSchema,
  CreateArtistInput,
  UpdateArtistInput,
  deriveNameLc,
  slugify,
  type Artist,
  type ArtistStatus,
} from "../domain/artist.js";
import { Errors } from "../domain/errors.js";
import { emitAlert } from "../lib/alerting.js";
import { db, bucket } from "../lib/firebase.js";
import { buildApproveHandler, buildRejectHandler } from "../lib/moderation.js";
import { SignedUploadInput, mintSignedUpload } from "../lib/signedUpload.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

/**
 * Artist routes (ADR-007 — Sprint 2).
 *
 * CTR-100 — POST /signed-upload                — bearer
 * CTR-101 — POST /                              — bearer (customer→pending, admin→published)
 * CTR-102 — GET /                               — bearer (customer scoped to own+published)
 * CTR-103 — GET /:id                            — bearer (404-hide for non-owner non-admin pending)
 * CTR-104 — PATCH /:id                          — bearer (owner or admin)
 * CTR-105 — DELETE /:id                         — bearer (owner or admin; 409 when products reference it)
 * CTR-106 — POST /:id/approve                   — admin (404, 409 already-published)
 * CTR-107 — POST /:id/reject                    — admin (404; reason from body or default)
 *
 * Approve/reject share `lib/moderation.ts` with the products route — see
 * DECISION-2026-05-05-018. Re-approval after rejection and re-rejection of
 * published artists are intentionally allowed (DECISION-2026-05-05-017) so
 * admins can correct their own decisions; both transitions are audit-logged
 * via `alert.kind=admin_action`.
 */

const COLLECTION = "artists";
const PRODUCTS_COLLECTION = "products";
const IMAGE_PREFIX = "artist-images";
const ARTIST_IMAGE_READ_URL_TTL_MS = 60 * 60 * 1000;

const DELETE_BLOCK_PEEK = 5;

const parseStatusFilter = (raw: unknown): ArtistStatus[] | null => {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const known: Record<string, true> = { pending: true, published: true, rejected: true };
  const out = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s in known) as ArtistStatus[];
  return out.length > 0 ? out : null;
};

export const artistsRouter = (env: Env): ExpressRouter => {
  const router = Router();
  router.use(requireAuth(env));

  router.post("/signed-upload", async (req, res, next) => {
    try {
      const input = SignedUploadInput.parse(req.body);
      const out = await mintSignedUpload(env, IMAGE_PREFIX, req.user!.uid, input);
      res.status(201).json(out);
    } catch (err) {
      void emitAlert(env, {
        kind: "upload_validation_fail",
        severity: "info",
        message: (err as Error).message ?? "upload validation failed",
        context: {
          requestId: req.requestId ?? "unknown",
          userUid: req.user?.uid ?? null,
        },
      });
      next(err);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      const input = CreateArtistInput.parse(req.body);
      const isAdmin = req.user!.role === "admin";
      const status: ArtistStatus = isAdmin ? "published" : "pending";
      const now = new Date().toISOString();
      const name_lc = deriveNameLc(input.name);
      const slug = slugify(input.name);

      const created = await runUniqueWriteTxn(env, name_lc, slug, async (txn, ref) => {
        const artist: Artist = {
          id: ref.id,
          name: input.name,
          name_lc,
          slug,
          ...(input.bio !== undefined ? { bio: input.bio } : {}),
          ...(input.country !== undefined ? { country: input.country } : {}),
          ...(input.imageObjectPath !== undefined
            ? { imageObjectPath: input.imageObjectPath }
            : {}),
          status,
          ownerUid: req.user!.uid,
          ownerEmail: req.user!.email,
          createdAt: now,
          updatedAt: now,
          ...(isAdmin ? { approvedAt: now, approvedBy: req.user!.uid } : {}),
        };
        txn.set(ref, artist);
        return artist;
      });

      res.status(201).json(await toArtistResponse(env, ArtistSchema.parse(created)));
    } catch (err) {
      next(err);
    }
  });

  router.get("/", async (req, res, next) => {
    try {
      const isAdmin = req.user!.role === "admin";
      const requestedStatus = parseStatusFilter(req.query["status"]);
      const requestedOwnerUid =
        typeof req.query["ownerUid"] === "string" ? (req.query["ownerUid"] as string) : null;

      let q = db(env).collection(COLLECTION).orderBy("createdAt", "desc").limit(100);

      if (isAdmin) {
        if (requestedOwnerUid) q = q.where("ownerUid", "==", requestedOwnerUid);
        if (requestedStatus && requestedStatus.length === 1) {
          q = q.where("status", "==", requestedStatus[0]);
        } else if (requestedStatus && requestedStatus.length > 1) {
          q = q.where("status", "in", requestedStatus);
        }
      } else if (requestedOwnerUid && requestedOwnerUid === req.user!.uid) {
        q = q.where("ownerUid", "==", req.user!.uid);
        if (requestedStatus && requestedStatus.length === 1) {
          q = q.where("status", "==", requestedStatus[0]);
        } else if (requestedStatus && requestedStatus.length > 1) {
          q = q.where("status", "in", requestedStatus);
        }
      } else {
        q = q.where("status", "==", "published");
      }

      const snap = await q.get();
      const items = snap.docs.map((d) => ArtistSchema.parse(d.data()));
      res.json({ items: await Promise.all(items.map((artist) => toArtistResponse(env, artist))) });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const id = req.params["id"]!;
      const ref = db(env).collection(COLLECTION).doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw Errors.notFound("artist");
      const artist = ArtistSchema.parse(snap.data());
      const isAdmin = req.user!.role === "admin";
      const isOwner = artist.ownerUid === req.user!.uid;
      if (!isAdmin && !isOwner && artist.status !== "published") {
        throw Errors.notFound("artist");
      }
      res.json(await toArtistResponse(env, artist));
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", async (req, res, next) => {
    try {
      const id = req.params["id"]!;
      const input = UpdateArtistInput.parse(req.body);
      const ref = db(env).collection(COLLECTION).doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw Errors.notFound("artist");
      const existing = ArtistSchema.parse(snap.data());
      const isAdmin = req.user!.role === "admin";
      const isOwner = existing.ownerUid === req.user!.uid;
      if (!isAdmin && !isOwner) throw Errors.forbidden();

      const patch: Partial<CreateArtistInput> = Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined)
      );

      const now = new Date().toISOString();
      const renamed = patch.name !== undefined && patch.name !== existing.name;

      const merged: Artist = {
        ...existing,
        ...patch,
        ...(renamed
          ? {
              name_lc: deriveNameLc(patch.name as string),
              slug: slugify(patch.name as string),
            }
          : {}),
        updatedAt: now,
      };

      if (renamed) {
        await runUniqueWriteTxn(
          env,
          merged.name_lc,
          merged.slug,
          async (txn) => {
            txn.set(ref, merged);
            return merged;
          },
          id
        );
      } else {
        await ref.set(merged);
      }

      res.json(await toArtistResponse(env, ArtistSchema.parse(merged)));
    } catch (err) {
      next(err);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      const id = req.params["id"]!;
      const ref = db(env).collection(COLLECTION).doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw Errors.notFound("artist");
      const existing = ArtistSchema.parse(snap.data());
      const isAdmin = req.user!.role === "admin";
      const isOwner = existing.ownerUid === req.user!.uid;
      if (!isAdmin && !isOwner) throw Errors.forbidden();

      const blockingSnap = await db(env)
        .collection(PRODUCTS_COLLECTION)
        .where("artistId", "==", id)
        .limit(DELETE_BLOCK_PEEK + 1)
        .get();

      if (!blockingSnap.empty) {
        const blockingProductIds = blockingSnap.docs.slice(0, DELETE_BLOCK_PEEK).map((d) => d.id);
        throw Errors.conflict("Artist has products attached", {
          blockingProductIds,
          hasMore: blockingSnap.size > DELETE_BLOCK_PEEK,
        });
      }

      await ref.delete();
      if (existing.imageObjectPath) {
        try {
          await bucket(env).file(existing.imageObjectPath).delete({ ignoreNotFound: true });
        } catch {
          void 0;
        }
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/:id/approve",
    requireRole("admin"),
    buildApproveHandler(env, {
      collection: COLLECTION,
      schema: ArtistSchema,
      resourceLabel: "artist",
      alertKind: "admin_action",
    })
  );

  router.post(
    "/:id/reject",
    requireRole("admin"),
    buildRejectHandler(env, {
      collection: COLLECTION,
      schema: ArtistSchema,
      resourceLabel: "artist",
      alertKind: "admin_action",
    })
  );

  return router;
};

/**
 * Run a write transaction that enforces uniqueness on `name_lc` AND `slug`.
 *
 * Reads:
 *   - up to 1 artist where `name_lc == :name_lc` (excluding `excludeId` if given)
 *   - up to 1 artist where `slug == :slug`     (excluding `excludeId` if given)
 *
 * If either match exists → throws 409 CONFLICT.
 *
 * Otherwise → calls `op(txn, ref)` where `ref` is a fresh doc ref the caller
 * can write to. Returns whatever `op` returns.
 *
 * Firestore transactions retry automatically on contention; the write
 * inside `op` is what makes the read+check atomic.
 */
async function runUniqueWriteTxn<T>(
  env: Env,
  name_lc: string,
  slug: string,
  op: (txn: FirebaseFirestore.Transaction, ref: FirebaseFirestore.DocumentReference) => Promise<T>,
  excludeId?: string
): Promise<T> {
  const col = db(env).collection(COLLECTION);
  const ref = excludeId ? col.doc(excludeId) : col.doc();

  return db(env).runTransaction(async (txn) => {
    const nameQuery = await txn.get(col.where("name_lc", "==", name_lc).limit(1));
    if (!nameQuery.empty && nameQuery.docs[0]!.id !== excludeId) {
      throw Errors.conflict("An artist with this name already exists");
    }
    const slugQuery = await txn.get(col.where("slug", "==", slug).limit(1));
    if (!slugQuery.empty && slugQuery.docs[0]!.id !== excludeId) {
      throw Errors.conflict("An artist with this slug already exists");
    }
    return op(txn, ref);
  });
}

const mintArtistImageReadUrl = async (
  env: Env,
  objectPath: string
): Promise<string | undefined> => {
  if (env.FIREBASE_STORAGE_EMULATOR_HOST) {
    const origin = env.FIREBASE_STORAGE_EMULATOR_HOST.startsWith("http")
      ? env.FIREBASE_STORAGE_EMULATOR_HOST
      : `http://${env.FIREBASE_STORAGE_EMULATOR_HOST}`;
    return `${origin}/v0/b/${encodeURIComponent(env.FIREBASE_STORAGE_BUCKET)}/o/${encodeURIComponent(objectPath)}?alt=media`;
  }
  try {
    const [url] = await bucket(env)
      .file(objectPath)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: new Date(Date.now() + ARTIST_IMAGE_READ_URL_TTL_MS),
      });
    return url;
  } catch {
    return undefined;
  }
};

const toArtistResponse = async (env: Env, artist: Artist): Promise<Artist> => {
  if (artist.imageUrl || !artist.imageObjectPath) return artist;
  const imageUrl = await mintArtistImageReadUrl(env, artist.imageObjectPath);
  return imageUrl ? { ...artist, imageUrl } : artist;
};
