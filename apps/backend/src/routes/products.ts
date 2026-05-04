import { Router, type Router as ExpressRouter } from "express";

import type { Env } from "../config/env.js";
import { Errors } from "../domain/errors.js";
import {
  CreateProductInput,
  UpdateProductInput,
  SignedUploadInput,
  ProductSchema,
  type Product,
  type ProductStatus,
} from "../domain/product.js";
import { emitAlert } from "../lib/alerting.js";
import { db, bucket } from "../lib/firebase.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const COLLECTION = "products";
const COVER_PREFIX = "cover-art";

export const productsRouter = (env: Env): ExpressRouter => {
  const router = Router();
  router.use(requireAuth(env));

  // POST /products/signed-upload — issue a signed URL for direct-to-Storage upload (CTR-002)
  router.post("/signed-upload", async (req, res, next) => {
    try {
      const input = SignedUploadInput.parse(req.body);
      const objectPath = `${COVER_PREFIX}/${req.user!.uid}/${Date.now()}-${crypto.randomUUID()}`;
      const file = bucket(env).file(objectPath);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
      const [uploadUrl] = await file.getSignedUrl({
        version: "v4",
        action: "write",
        expires: expiresAt,
        contentType: input.contentType,
      });
      res.status(201).json({
        uploadUrl,
        objectPath,
        expiresAt: expiresAt.toISOString(),
      });
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
      const status: ProductStatus = isAdmin ? "published" : "pending";
      const product: Product = {
        id: doc.id,
        name: input.name,
        artistName: input.artistName,
        coverArtPath: input.coverArtPath,
        status,
        ownerUid: req.user!.uid,
        ownerEmail: req.user!.email,
        createdAt: now,
        updatedAt: now,
        ...(isAdmin ? { approvedAt: now, approvedBy: req.user!.uid } : {}),
      };
      await doc.set(product);
      res.status(201).json(ProductSchema.parse(product));
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
      res.json({ items });
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
      res.json(product);
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
      res.json(updated);
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
  router.post("/:id/approve", requireRole("admin"), async (req, res, next) => {
    try {
      const id = req.params["id"]!;
      const ref = db(env).collection(COLLECTION).doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw Errors.notFound("product");
      const existing = ProductSchema.parse(snap.data());
      if (existing.status === "published") throw Errors.conflict("Product already published");
      const now = new Date().toISOString();
      const updated: Product = {
        ...existing,
        status: "published",
        approvedAt: now,
        approvedBy: req.user!.uid,
        updatedAt: now,
      };
      await ref.set(updated);
      // Informational alert event (drives the admin-action SLO dashboard)
      void emitAlert(env, {
        kind: "admin_action",
        severity: "info",
        message: `admin approved product ${id}`,
        context: { productId: id, adminUid: req.user!.uid },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // POST /products/:id/reject — admin-only rejection (CTR-009)
  router.post("/:id/reject", requireRole("admin"), async (req, res, next) => {
    try {
      const id = req.params["id"]!;
      const reason = typeof req.body?.reason === "string" ? req.body.reason : "Rejected by admin";
      const ref = db(env).collection(COLLECTION).doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw Errors.notFound("product");
      const existing = ProductSchema.parse(snap.data());
      const now = new Date().toISOString();
      const updated: Product = {
        ...existing,
        status: "rejected",
        rejectionReason: reason,
        updatedAt: now,
      };
      await ref.set(updated);
      void emitAlert(env, {
        kind: "admin_action",
        severity: "info",
        message: `admin rejected product ${id}`,
        context: { productId: id, adminUid: req.user!.uid, reason },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  return router;
};
