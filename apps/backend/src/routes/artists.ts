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

/** Maximum number of blocking product ids returned in a delete-409 response. */
const DELETE_BLOCK_PEEK = 5;

/** Parse a comma-separated `?status=` query into an array of statuses. */
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

  // CTR-100 — POST /signed-upload
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

  // CTR-101 — POST /
  // Customer → pending; admin → published immediately.
  // Name uniqueness enforced via Firestore transaction on `name_lc` + `slug`.
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

      res.status(201).json(ArtistSchema.parse(created));
    } catch (err) {
      next(err);
    }
  });

  // CTR-102 — GET /
  // Customer sees own + published; admin sees all (with optional ?status / ?ownerUid).
  router.get("/", async (req, res, next) => {
    try {
      const isAdmin = req.user!.role === "admin";
      const requestedStatus = parseStatusFilter(req.query["status"]);
      const requestedOwnerUid =
        typeof req.query["ownerUid"] === "string" ? (req.query["ownerUid"] as string) : null;

      // Build the query. We always order by createdAt desc for the public list;
      // composite indexes back the (status, createdAt) and (ownerUid, createdAt)
      // patterns we need.
      let q = db(env).collection(COLLECTION).orderBy("createdAt", "desc").limit(100);

      if (isAdmin) {
        if (requestedOwnerUid) q = q.where("ownerUid", "==", requestedOwnerUid);
        if (requestedStatus && requestedStatus.length === 1) {
          q = q.where("status", "==", requestedStatus[0]);
        } else if (requestedStatus && requestedStatus.length > 1) {
          q = q.where("status", "in", requestedStatus);
        }
      } else if (requestedOwnerUid && requestedOwnerUid === req.user!.uid) {
        // Customer scoping their own artists: own (any status), filter by status if provided.
        q = q.where("ownerUid", "==", req.user!.uid);
        if (requestedStatus && requestedStatus.length === 1) {
          q = q.where("status", "==", requestedStatus[0]);
        } else if (requestedStatus && requestedStatus.length > 1) {
          q = q.where("status", "in", requestedStatus);
        }
      } else {
        // Customer default — published only. `?ownerUid` for someone else is silently
        // ignored (we don't 403 because the data is just not visible).
        q = q.where("status", "==", "published");
      }

      const snap = await q.get();
      const items = snap.docs.map((d) => ArtistSchema.parse(d.data()));
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  // CTR-103 — GET /:id
  // 404-hide for non-owner non-admin on a non-published artist.
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
      res.json(artist);
    } catch (err) {
      next(err);
    }
  });

  // CTR-104 — PATCH /:id
  // Owner or admin. Renaming triggers a fresh uniqueness check (txn).
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

      // Strip undefined keys; partial update semantics.
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
        // Uniqueness re-check on rename. Excludes the artist's own document.
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

      res.json(ArtistSchema.parse(merged));
    } catch (err) {
      next(err);
    }
  });

  // CTR-105 — DELETE /:id
  // Owner or admin. **Rejected with 409 when any product references this artist.**
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

      // FK referential check. Pull DELETE_BLOCK_PEEK to know whether
      // there's a "+more" tail without an unbounded scan.
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
      // Best-effort image cleanup.
      if (existing.imageObjectPath) {
        try {
          await bucket(env).file(existing.imageObjectPath).delete({ ignoreNotFound: true });
        } catch {
          /* swallowed: image removal is best-effort */
        }
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // CTR-106 — POST /:id/approve — admin-only approval.
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

  // CTR-107 — POST /:id/reject — admin-only rejection.
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
