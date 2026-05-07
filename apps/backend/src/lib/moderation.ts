/**
 * Shared moderation handlers (CTR-008, CTR-009 for products; CTR-106, CTR-107
 * for artists).
 *
 * Both products and artists share the same admin-approval lifecycle:
 *   pending → published (via approve)
 *   any-non-rejected → rejected (via reject)
 *
 * Re-approval after rejection is allowed (admins can undo their own
 * rejection if a customer follows up with corrections). Re-rejection of a
 * published item is also allowed (admins can pull a published item back
 * down). Both transitions emit `alert.kind=admin_action` so the audit log
 * captures every state change.
 *
 * Re-approval does NOT clear `rejectionReason` — it is intentionally left
 * on the document for audit trail visibility. The status field is the
 * authoritative current state; `rejectionReason` is the historical "this
 * was previously rejected because…" record.
 *
 * See DECISION-2026-05-05-017 (re-approval / re-rejection state machine)
 * and DECISION-2026-05-05-018 (shared moderation handler) for the full
 * rationale and alternatives.
 */
import type { RequestHandler } from "express";
import type { z } from "zod";

import type { Env } from "../config/env.js";
import { Errors } from "../domain/errors.js";

import { emitAlert, type AlertKind } from "./alerting.js";
import { db } from "./firebase.js";

/**
 * Minimum shape every moderatable resource must satisfy. Both `Artist` and
 * `Product` are structurally compatible with this — Zod schemas parse out
 * to objects that include all these fields.
 */
interface ModeratableResource {
  id: string;
  status: string;
  updatedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  [k: string]: unknown;
}

export interface ModerationConfig {
  /** Firestore collection name (e.g. "products", "artists"). */
  collection: string;
  /**
   * Zod schema used to parse the existing document and the response. The
   * parsed shape must include the moderation fields (`status`, `id`,
   * `updatedAt`, optionally `approvedAt` / `approvedBy` / `rejectionReason`)
   * — both `ProductSchema` and `ArtistSchema` satisfy this.
   */
  schema: z.ZodTypeAny;
  /**
   * Singular resource label used in error messages and alert log lines —
   * e.g. "product" or "artist". Lowercase.
   */
  resourceLabel: string;
  /**
   * Alert kind emitted on every state change. Currently always
   * `"admin_action"` — kept parameterisable so a future ticket can route
   * artist actions to a separate dashboard if needed.
   */
  alertKind: AlertKind;
}

/**
 * Build an approve handler. Mounts cleanly under
 * `router.post("/:id/approve", requireRole("admin"), buildApproveHandler(env, config))`.
 *
 * Behaviour:
 *  - 404 if the document does not exist.
 *  - 409 if the document is already `published` (no-op rejection — clients
 *    that re-issue approve on a published doc should be told nothing
 *    changed; this is the same shape as products had pre-MUGA-17).
 *  - Otherwise: sets status=published, approvedAt=now, approvedBy=adminUid,
 *    updatedAt=now. Emits `admin_action` info-level alert.
 */
export const buildApproveHandler =
  (env: Env, config: ModerationConfig): RequestHandler =>
  async (req, res, next) => {
    try {
      const id = req.params["id"]!;
      const ref = db(env).collection(config.collection).doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw Errors.notFound(config.resourceLabel);
      const existing = config.schema.parse(snap.data()) as ModeratableResource;
      if (existing.status === "published") {
        throw Errors.conflict(`${capitalise(config.resourceLabel)} already published`);
      }
      const now = new Date().toISOString();
      const updated: ModeratableResource = {
        ...existing,
        status: "published",
        approvedAt: now,
        approvedBy: req.user!.uid,
        updatedAt: now,
      };
      await ref.set(updated);
      void emitAlert(env, {
        kind: config.alertKind,
        severity: "info",
        message: `admin approved ${config.resourceLabel} ${id}`,
        context: { [`${config.resourceLabel}Id`]: id, adminUid: req.user!.uid, action: "approve" },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  };

/**
 * Build a reject handler. Mounts under
 * `router.post("/:id/reject", requireRole("admin"), buildRejectHandler(env, config))`.
 *
 * Behaviour:
 *  - 404 if the document does not exist.
 *  - Reason: `req.body.reason` if it is a string (any string value,
 *    including empty), otherwise the default `"Rejected by admin"`.
 *    Non-string reasons (number, array, null) coerce to the default.
 *  - Always allowed regardless of current status (re-rejection of a
 *    published doc is the canonical "pull-down" operation; re-rejection
 *    of an already-rejected doc just refreshes the reason).
 *  - Sets status=rejected, rejectionReason=<reason>, updatedAt=now. Does
 *    NOT clear approvedAt/approvedBy — leaves them as historical record.
 *  - Emits `admin_action` info-level alert with the reason.
 */
export const buildRejectHandler =
  (env: Env, config: ModerationConfig): RequestHandler =>
  async (req, res, next) => {
    try {
      const id = req.params["id"]!;
      const body = req.body as { reason?: unknown };
      const reason = typeof body.reason === "string" ? body.reason : "Rejected by admin";
      const ref = db(env).collection(config.collection).doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw Errors.notFound(config.resourceLabel);
      const existing = config.schema.parse(snap.data()) as ModeratableResource;
      const now = new Date().toISOString();
      const updated: ModeratableResource = {
        ...existing,
        status: "rejected",
        rejectionReason: reason,
        updatedAt: now,
      };
      await ref.set(updated);
      void emitAlert(env, {
        kind: config.alertKind,
        severity: "info",
        message: `admin rejected ${config.resourceLabel} ${id}`,
        context: {
          [`${config.resourceLabel}Id`]: id,
          adminUid: req.user!.uid,
          action: "reject",
          reason,
        },
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  };

const capitalise = (s: string) => s[0]!.toUpperCase() + s.slice(1);
