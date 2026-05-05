import { Router, type Router as ExpressRouter } from "express";

import type { Env } from "../config/env.js";
import { ArtistSchema, type Artist, type ArtistStatus } from "../domain/artist.js";
import { Errors } from "../domain/errors.js";
import {
  CreateProductInput,
  UpdateProductInput,
  ProductSchema,
  type Product,
  type ProductStatus,
} from "../domain/product.js";
import { emitAlert } from "../lib/alerting.js";
import { db, bucket } from "../lib/firebase.js";
import { buildApproveHandler, buildRejectHandler } from "../lib/moderation.js";
import { SignedUploadInput, mintSignedUpload } from "../lib/signedUpload.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const COLLECTION = "products";
const ARTISTS_COLLECTION = "artists";
const COVER_PREFIX = "cover-art";

type ProductArtist = {
  id: string;
  name: string;
  status: ArtistStatus;
  imageUrl?: string;
};

type ProductResponse = Product & { artist: ProductArtist };

export const productsRouter = (env: Env): ExpressRouter => {
  const router = Router();
  router.use(requireAuth(env));

  // POST /products/signed-upload — issue a signed URL for direct-to-Storage upload (CTR-002)
  router.post("/signed-upload", async (req, res, next) => {
    try {
      const input = SignedUploadInput.parse(req.body);
      const out = await mintSignedUpload(env, COVER_PREFIX, req.user!.uid, input);
      res.status(201).json(out);
    } catch (err) {
      // Emit upload-validation failure event for spike alerting (A5)
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

  // POST /products — create a product (CTR-003)
  router.post("/", async (req, res, next) => {
    try {
      const input = CreateProductInput.parse(req.body);
      const now = new Date().toISOString();
      const doc = db(env).collection(COLLECTION).doc();
      const isAdmin = req.user!.role === "admin";
      const artist = await validateArtistForWrite(env, input.artistId, req.user!);
      const status: ProductStatus = isAdmin ? "published" : "pending";
      const product: Product = {
        id: doc.id,
        name: input.name,
        artistId: input.artistId,
        coverArtPath: input.coverArtPath,
        status,
        ownerUid: req.user!.uid,
        ownerEmail: req.user!.email,
        createdAt: now,
        updatedAt: now,
        ...(isAdmin ? { approvedAt: now, approvedBy: req.user!.uid } : {}),
      };
      await doc.set(product);
      if (isAdmin && artist.status === "pending") {
        emitAdminOverride(env, doc.id, artist.id, req.user!.uid, artist.status);
      }
      res.status(201).json(await toProductResponse(env, ProductSchema.parse(product)));
    } catch (err) {
      next(err);
    }
  });

  // GET /products — list products (CTR-004)
  router.get("/", async (req, res, next) => {
    try {
      const isAdmin = req.user!.role === "admin";
      const requestedStatus = req.query["status"];
      let q = db(env).collection(COLLECTION).orderBy("createdAt", "desc").limit(100);
      if (isAdmin && typeof requestedStatus === "string") {
        q = q.where("status", "==", requestedStatus);
      } else if (!isAdmin) {
        q = q.where("status", "==", "published");
      }
      const snap = await q.get();
      const items = snap.docs.map((d) => ProductSchema.parse(d.data()));
      // MUGA-18 hard-cut: products store `artistId`; list/read dereference the
      // current artist document so artist renames show up on the next render.
      // At <=100 products this is acceptable. If observed list p95 exceeds
      // 500ms, denormalise `{artistName, artistImageUrl}` onto the product and
      // refresh via a background task.
      res.json({ items: await Promise.all(items.map((p) => toProductResponse(env, p))) });
    } catch (err) {
      next(err);
    }
  });

  // GET /products/:id — read one product (CTR-005)
  router.get("/:id", async (req, res, next) => {
    try {
      const id = req.params["id"]!;
      const ref = db(env).collection(COLLECTION).doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw Errors.notFound("product");
      const product = ProductSchema.parse(snap.data());
      const isAdmin = req.user!.role === "admin";
      const isOwner = product.ownerUid === req.user!.uid;
      if (!isAdmin && !isOwner && product.status !== "published") {
        throw Errors.notFound("product");
      }
      res.json(await toProductResponse(env, product));
    } catch (err) {
      next(err);
    }
  });

  // PATCH /products/:id — update product (CTR-006). Owner or admin.
  router.patch("/:id", async (req, res, next) => {
    try {
      const id = req.params["id"]!;
      const input = UpdateProductInput.parse(req.body);
      const ref = db(env).collection(COLLECTION).doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw Errors.notFound("product");
      const existing = ProductSchema.parse(snap.data());
      const isAdmin = req.user!.role === "admin";
      const isOwner = existing.ownerUid === req.user!.uid;
      if (!isAdmin && !isOwner) throw Errors.forbidden();
      const nextArtist =
        input.artistId !== undefined
          ? await validateArtistForWrite(env, input.artistId, req.user!)
          : null;
      // Strip undefined keys before spreading so partial updates do not
      // clobber existing required fields with `undefined` (TS + runtime safe).
      const patch: Partial<CreateProductInput> = Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined)
      );
      const updated: Product = {
        ...existing,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      await ref.set(updated);
      if (isAdmin && nextArtist?.status === "pending") {
        emitAdminOverride(env, id, nextArtist.id, req.user!.uid, nextArtist.status);
      }
      res.json(await toProductResponse(env, updated));
    } catch (err) {
      next(err);
    }
  });

  // DELETE /products/:id — delete product (CTR-007). Owner or admin.
  router.delete("/:id", async (req, res, next) => {
    try {
      const id = req.params["id"]!;
      const ref = db(env).collection(COLLECTION).doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw Errors.notFound("product");
      const existing = ProductSchema.parse(snap.data());
      const isAdmin = req.user!.role === "admin";
      const isOwner = existing.ownerUid === req.user!.uid;
      if (!isAdmin && !isOwner) throw Errors.forbidden();
      await ref.delete();
      // Best-effort delete the cover-art object — failure should not block delete
      try {
        await bucket(env).file(existing.coverArtPath).delete({ ignoreNotFound: true });
      } catch {
        /* swallowed: cover-art removal is best-effort */
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // POST /products/:id/approve — admin-only approval (CTR-008)
  router.post(
    "/:id/approve",
    requireRole("admin"),
    buildApproveHandler(env, {
      collection: COLLECTION,
      schema: ProductSchema,
      resourceLabel: "product",
      alertKind: "admin_action",
    })
  );

  // POST /products/:id/reject — admin-only rejection (CTR-009)
  router.post(
    "/:id/reject",
    requireRole("admin"),
    buildRejectHandler(env, {
      collection: COLLECTION,
      schema: ProductSchema,
      resourceLabel: "product",
      alertKind: "admin_action",
    })
  );

  return router;
};

const toProductArtist = (artist: Artist): ProductArtist => ({
  id: artist.id,
  name: artist.name,
  status: artist.status,
  ...(artist.imageUrl !== undefined ? { imageUrl: artist.imageUrl } : {}),
});

const loadArtist = async (env: Env, artistId: string): Promise<Artist> => {
  const snap = await db(env).collection(ARTISTS_COLLECTION).doc(artistId).get();
  if (!snap.exists) throw Errors.artistNotFound(artistId);
  return ArtistSchema.parse(snap.data());
};

const validateArtistForWrite = async (
  env: Env,
  artistId: string,
  actor: { role: "admin" | "customer"; uid: string }
): Promise<Artist> => {
  const artist = await loadArtist(env, artistId);
  if (artist.status === "published") return artist;
  if (artist.status === "pending" && (actor.role === "admin" || artist.ownerUid === actor.uid)) {
    return artist;
  }
  throw Errors.artistNotPublished(artistId);
};

const toProductResponse = async (env: Env, product: Product): Promise<ProductResponse> => ({
  ...product,
  artist: toProductArtist(await loadArtist(env, product.artistId)),
});

const emitAdminOverride = (
  env: Env,
  productId: string,
  artistId: string,
  adminUid: string,
  artistStatus: ArtistStatus
) => {
  void emitAlert(env, {
    kind: "admin_override",
    severity: "info",
    message: `admin attached product ${productId} to ${artistStatus} artist ${artistId}`,
    context: { productId, artistId, adminUid, artistStatus },
  });
};
