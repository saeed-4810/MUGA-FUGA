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
const COVER_READ_URL_TTL_MS = 60 * 60 * 1000;
const ARTIST_IMAGE_READ_URL_TTL_MS = 60 * 60 * 1000;

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

  router.post("/signed-upload", async (req, res, next) => {
    try {
      const input = SignedUploadInput.parse(req.body);
      const out = await mintSignedUpload(env, COVER_PREFIX, req.user!.uid, input);
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

  router.get("/", async (req, res, next) => {
    try {
      const isAdmin = req.user!.role === "admin";
      const requestedStatus = req.query["status"];
      const collection = db(env).collection(COLLECTION);
      let q = collection.orderBy("createdAt", "desc").limit(100);
      if (isAdmin && typeof requestedStatus === "string") {
        q = q.where("status", "==", requestedStatus);
      } else if (!isAdmin) {
        const [publishedSnap, ownPendingSnap] = await Promise.all([
          collection
            .where("status", "==", "published")
            .orderBy("createdAt", "desc")
            .limit(100)
            .get(),
          collection
            .where("ownerUid", "==", req.user!.uid)
            .where("status", "==", "pending")
            .orderBy("createdAt", "desc")
            .limit(100)
            .get(),
        ]);
        const items = [...publishedSnap.docs, ...ownPendingSnap.docs]
          .map((d) => ProductSchema.parse(d.data()))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 100);
        res.json({ items: await Promise.all(items.map((p) => toProductResponse(env, p))) });
        return;
      }
      const snap = await q.get();
      const items = snap.docs.map((d) => ProductSchema.parse(d.data()));
      res.json({ items: await Promise.all(items.map((p) => toProductResponse(env, p))) });
    } catch (err) {
      next(err);
    }
  });

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
      try {
        await bucket(env).file(existing.coverArtPath).delete({ ignoreNotFound: true });
      } catch {
        void 0;
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
      schema: ProductSchema,
      resourceLabel: "product",
      alertKind: "admin_action",
    })
  );

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

const mintStorageReadUrl = async (
  env: Env,
  objectPath: string,
  ttlMs: number
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
        expires: new Date(Date.now() + ttlMs),
      });
    return url;
  } catch {
    return undefined;
  }
};

const toProductArtist = async (env: Env, artist: Artist): Promise<ProductArtist> => {
  const imageUrl =
    artist.imageUrl ??
    (artist.imageObjectPath
      ? await mintStorageReadUrl(env, artist.imageObjectPath, ARTIST_IMAGE_READ_URL_TTL_MS)
      : undefined);
  return {
    id: artist.id,
    name: artist.name,
    status: artist.status,
    ...(imageUrl ? { imageUrl } : {}),
  };
};

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

const mintCoverArtReadUrl = async (env: Env, objectPath: string): Promise<string | undefined> => {
  return mintStorageReadUrl(env, objectPath, COVER_READ_URL_TTL_MS);
};

const toProductResponse = async (env: Env, product: Product): Promise<ProductResponse> => {
  const [artist, generatedCoverArtUrl] = await Promise.all([
    loadArtist(env, product.artistId),
    mintCoverArtReadUrl(env, product.coverArtPath),
  ]);
  const [coverArtUrl, productArtist] = await Promise.all([
    Promise.resolve(product.coverArtUrl ?? generatedCoverArtUrl),
    toProductArtist(env, artist),
  ]);
  return {
    ...product,
    ...(coverArtUrl ? { coverArtUrl } : {}),
    artist: productArtist,
  };
};

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
