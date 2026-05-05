/* eslint-disable import/order -- known false positive: the import-order rule
   misclassifies type-only + value imports under alphabetise mode. The block is
   hand-sorted: external (express, supertest, vitest) → internal, alphabetical
   by path. @typescript-eslint/consistent-type-imports still enforces correct
   `import type` usage. */
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { Env } from "../src/config/env.js";
import type { Artist } from "../src/domain/artist.js";
import { AppError } from "../src/domain/errors.js";
import { ProductSchema, type Product } from "../src/domain/product.js";
import { errorHandler, notFoundHandler } from "../src/middleware/error.js";
import { requestIdMiddleware } from "../src/middleware/requestId.js";
/* eslint-enable import/order */

/**
 * Tests for the Products CRUD + signed-upload + admin endpoints.
 *
 * Scenario coverage:
 *   T-UP-001..003     Signed-upload (CTR-002)
 *   T-PROD-001..003   Create (CTR-003)
 *   T-PROD-004..006   List (CTR-004)
 *   T-PROD-007        Read one (CTR-005)
 *   T-PROD-008..009   Update (CTR-006)
 *   T-PROD-010..011   Delete (CTR-007)
 *   T-PROD-012..015   Artist FK validation + dereference (MUGA-18)
 *   T-ADMIN-001..002  Approve (CTR-008)
 *   T-ADMIN-003       Reject (CTR-009)
 *
 * Strategy:
 *   - Mock `../src/lib/firebase.js` with a controllable in-memory Firestore
 *     + Storage.
 *   - Mock `../src/middleware/auth.js` with a test harness that sets
 *     `req.user` based on the `x-test-user` header (uid:role:email).
 *     requireAuth rejects requests without the header (→ 401).
 *   - requireRole is re-exported from the real module (covered separately in auth.test.ts).
 */

// ─── Controllable Firestore + Storage state ────────────────────────────
type DocRec = { data: Product };
const store: Map<string, DocRec> = new Map();
type ArtistRec = { data: Artist };
const artistStore: Map<string, ArtistRec> = new Map();
const dbBehaviour: {
  getMode: "ok" | "throw";
  setMode: "ok" | "throw";
  deleteMode: "ok" | "throw";
} = { getMode: "ok", setMode: "ok", deleteMode: "ok" };

const storageBehaviour: {
  signedUrlMode: "ok" | "throw" | "throw-non-error";
  objectDeleteMode: "ok" | "throw";
} = { signedUrlMode: "ok", objectDeleteMode: "ok" };

const signedUrlCalls: Array<{ path: string; contentType: string }> = [];
const objectDeleteCalls: string[] = [];

let docCounter = 0;
const mintId = () => `prod-${++docCounter}`;

vi.mock("../src/lib/firebase.js", () => {
  const makeDocRef = (id: string) => ({
    id,
    get: async () => {
      if (dbBehaviour.getMode === "throw") throw new Error("firestore unavailable");
      const rec = store.get(id);
      return {
        exists: !!rec,
        data: () => rec?.data,
      };
    },
    set: async (data: Product) => {
      if (dbBehaviour.setMode === "throw") throw new Error("firestore write failed");
      store.set(id, { data });
    },
    delete: async () => {
      if (dbBehaviour.deleteMode === "throw") throw new Error("firestore delete failed");
      store.delete(id);
    },
  });

  // Minimal query builder
  const makeQuery = (filter: { status?: string } = {}) => ({
    orderBy: () => makeQuery(filter),
    limit: () => makeQuery(filter),
    where: (_field: string, _op: string, value: string) => makeQuery({ ...filter, status: value }),
    get: async () => {
      if (dbBehaviour.getMode === "throw") throw new Error("firestore unavailable");
      const docs = Array.from(store.entries())
        .filter(([, rec]) => !filter.status || rec.data.status === filter.status)
        .map(([id, rec]) => ({
          id,
          data: () => rec.data,
        }));
      return { docs };
    },
  });

  const makeArtistDocRef = (id: string) => ({
    id,
    get: async () => {
      const rec = artistStore.get(id);
      return { exists: !!rec, data: () => rec?.data };
    },
  });

  const collection = (name: string) => {
    if (name === "artists") {
      return { doc: (id: string) => makeArtistDocRef(id) };
    }
    return {
      doc: (id?: string) => makeDocRef(id ?? mintId()),
      orderBy: makeQuery().orderBy,
      limit: makeQuery().limit,
      where: makeQuery().where,
      get: makeQuery().get,
    };
  };

  return {
    db: () => ({ collection }),
    bucket: () => ({
      file: (objectPath: string) => ({
        getSignedUrl: async (opts: { contentType: string }) => {
          if (storageBehaviour.signedUrlMode === "throw") {
            throw new Error("signed url generation failed");
          }
          if (storageBehaviour.signedUrlMode === "throw-non-error") {
            // Throw a value without `.message` to exercise the
            // `(err as Error).message ?? "upload validation failed"`
            // fallback branch in products.ts.
            throw { notAnError: true } as unknown;
          }
          signedUrlCalls.push({ path: objectPath, contentType: opts.contentType });
          return [`https://storage.example.com/${objectPath}?sig=test`];
        },
        delete: async (_opts: { ignoreNotFound?: boolean }) => {
          if (storageBehaviour.objectDeleteMode === "throw") {
            throw new Error("storage delete failed");
          }
          objectDeleteCalls.push(objectPath);
        },
      }),
    }),
    auth: () => ({}),
    initFirebase: () => ({}),
  };
});

// ─── Mock auth middleware ──────────────────────────────────────────────
// Type for the importActual helper is derived from the real module path at
// runtime (avoids an extra `import type` that the import/order rule treats
// as a separate group and conflicts with blank-line rules).
type AuthMiddlewareModule = {
  requireAuth: unknown;
  requireRole: unknown;
};
vi.mock("../src/middleware/auth.js", async (importActual) => {
  const actual = (await importActual()) as AuthMiddlewareModule;
  return {
    // Real requireRole — covered separately in auth.test.ts, reused here.
    requireRole: actual.requireRole,
    // Lightweight requireAuth for product tests. Reads `x-test-user`
    // header formatted `<uid>:<role>:<email>`. Missing → 401 via Errors.
    requireAuth: () => (req: Request, _res: Response, next: NextFunction) => {
      const header = req.header("x-test-user");
      if (!header) {
        next(new AppError(401, "UNAUTHENTICATED", "Missing test user"));
        return;
      }
      // Special marker: `__no-uid__` creates a user object with no uid,
      // exercising the `req.user?.uid ?? null` fallback branch in
      // products.ts (line 50).
      if (header === "__no-uid__") {
        req.user = {
          uid: undefined as unknown as string,
          email: "x@example.com",
          role: "customer",
          emailVerified: true,
        };
        next();
        return;
      }
      const [uid, role, email] = header.split(":");
      req.user = {
        uid: uid!,
        role: (role as "admin" | "customer") ?? "customer",
        email: email ?? `${uid}@example.com`,
        emailVerified: true,
      };
      next();
    },
  };
});

// ─── Import after mocks ────────────────────────────────────────────────
import { productsRouter } from "../src/routes/products.js";

const stubEnv: Env = {
  NODE_ENV: "test",
  PORT: 3001,
  LOG_LEVEL: "info",
  CORS_ALLOWED_ORIGINS: ["http://localhost:5173"],
  FIREBASE_PROJECT_ID: "muga-test",
  FIREBASE_STORAGE_BUCKET: "muga-test.appspot.com",
  FIREBASE_SERVICE_ACCOUNT_JSON: "",
  INITIAL_ADMIN_EMAILS: [],
  SENTRY_DSN: "",
  SENTRY_ENVIRONMENT: "test",
  SENTRY_TRACES_SAMPLE_RATE: 0,
  SENTRY_PROFILES_SAMPLE_RATE: 0,
  FIRESTORE_EMULATOR_HOST: "",
  FIREBASE_AUTH_EMULATOR_HOST: "",
  FIREBASE_STORAGE_EMULATOR_HOST: "",
  SLACK_WEBHOOK_URL: "",
  PAGERDUTY_INTEGRATION_KEY: "",
  ALERT_EMAIL_RECIPIENTS: [],
  ALERT_READY_LATENCY_BUDGET_MS: 2000,
};

const buildApp = () => {
  const app = express();
  app.use(express.json());
  app.use(requestIdMiddleware);
  app.use("/products", productsRouter(stubEnv));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

const CUSTOMER = "uid-cust:customer:cust@example.com";
const CUSTOMER_B = "uid-cust-b:customer:custb@example.com";
const ADMIN = "uid-admin:admin:admin@example.com";

const seedProduct = (overrides: Partial<Product> = {}): Product => {
  const id = overrides.id ?? mintId();
  const now = new Date().toISOString();
  const product: Product = {
    id,
    name: "Seed Album",
    artistId: "art-1",
    coverArtPath: `cover-art/${id}/seed.jpg`,
    status: "pending",
    ownerUid: "uid-cust",
    ownerEmail: "cust@example.com",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  store.set(id, { data: product });
  return product;
};

const seedArtist = (overrides: Partial<Artist> = {}): Artist => {
  const now = new Date().toISOString();
  const id = overrides.id ?? "art-1";
  const name = overrides.name ?? "Seed Artist";
  const artist: Artist = {
    id,
    name,
    name_lc: name.trim().toLowerCase(),
    slug: name.trim().toLowerCase().replace(/\s+/g, "-"),
    status: "published",
    ownerUid: "uid-cust",
    ownerEmail: "cust@example.com",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  artistStore.set(id, { data: artist });
  return artist;
};

beforeEach(() => {
  store.clear();
  artistStore.clear();
  seedArtist();
  docCounter = 0;
  signedUrlCalls.length = 0;
  objectDeleteCalls.length = 0;
  dbBehaviour.getMode = "ok";
  dbBehaviour.setMode = "ok";
  dbBehaviour.deleteMode = "ok";
  storageBehaviour.signedUrlMode = "ok";
  storageBehaviour.objectDeleteMode = "ok";
});

// ══════════════════════════════════════════════════════════════════════
// CTR-002 — POST /products/signed-upload
// ══════════════════════════════════════════════════════════════════════

describe("T-UP-001..003: POST /products/signed-upload (CTR-002)", () => {
  it("T-UP-001 — unauthenticated → 401", async () => {
    const res = await request(buildApp())
      .post("/products/signed-upload")
      .send({ contentType: "image/jpeg", fileSize: 1024 });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });

  it("T-UP-002 — rejects non-image content type with 400 VALIDATION_ERROR", async () => {
    const res = await request(buildApp())
      .post("/products/signed-upload")
      .set("x-test-user", CUSTOMER)
      .send({ contentType: "application/pdf", fileSize: 1024 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.details.issues[0].message).toMatch(/JPEG|PNG|WEBP|AVIF/i);
  });

  it("T-UP-002b — rejects oversize (> 5 MB) with 400 VALIDATION_ERROR", async () => {
    const res = await request(buildApp())
      .post("/products/signed-upload")
      .set("x-test-user", CUSTOMER)
      .send({ contentType: "image/jpeg", fileSize: 5 * 1024 * 1024 + 1 });
    expect(res.status).toBe(400);
    expect(res.body.details.issues[0].message).toMatch(/5 MB/);
  });

  it("T-UP-002c — emits alert.kind=upload_validation_fail on validation failure (A5)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await request(buildApp())
      .post("/products/signed-upload")
      .set("x-test-user", CUSTOMER)
      .send({ contentType: "application/pdf", fileSize: 1024 });
    const fired = info.mock.calls.find((c) => {
      const obj = c[0] as Record<string, unknown> | undefined;
      return obj && (obj as { alert?: { kind?: string } }).alert?.kind === "upload_validation_fail";
    });
    expect(fired).toBeTruthy();
    info.mockRestore();
  });

  it("T-UP-003 — happy path returns signed URL + objectPath + expiresAt", async () => {
    const res = await request(buildApp())
      .post("/products/signed-upload")
      .set("x-test-user", CUSTOMER)
      .send({ contentType: "image/jpeg", fileSize: 1024 });
    expect(res.status).toBe(201);
    expect(res.body.uploadUrl).toMatch(/^https:\/\/storage\.example\.com\//);
    expect(res.body.objectPath).toMatch(/^cover-art\/uid-cust\/\d+-/);
    expect(typeof res.body.expiresAt).toBe("string");
    expect(new Date(res.body.expiresAt).toString()).not.toBe("Invalid Date");
    expect(signedUrlCalls).toHaveLength(1);
    expect(signedUrlCalls[0]!.contentType).toBe("image/jpeg");
  });

  it("T-UP-003b — surfaces Storage failures through error handler", async () => {
    storageBehaviour.signedUrlMode = "throw";
    const res = await request(buildApp())
      .post("/products/signed-upload")
      .set("x-test-user", CUSTOMER)
      .send({ contentType: "image/jpeg", fileSize: 1024 });
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("INTERNAL");
  });

  it("T-UP-003c — emit-alert fallbacks trigger when requestId and user.uid are absent", async () => {
    // Build an app WITHOUT requestIdMiddleware to exercise the
    // `req.requestId ?? "unknown"` fallback (products.ts line 49) and use
    // the special `__no-uid__` marker to set a user with `uid=undefined`,
    // exercising the `req.user?.uid ?? null` fallback (products.ts line 50).
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const app = express();
    app.use(express.json());
    // No requestIdMiddleware.
    app.use("/products", productsRouter(stubEnv));
    app.use(notFoundHandler);
    app.use(errorHandler);

    const res = await request(app)
      .post("/products/signed-upload")
      .set("x-test-user", "__no-uid__")
      .send({ contentType: "application/pdf", fileSize: 1024 });
    expect(res.status).toBe(400);
    const fired = info.mock.calls.find((c) => {
      const obj = c[0] as Record<string, unknown> | undefined;
      return obj && (obj as { alert?: { kind?: string } }).alert?.kind === "upload_validation_fail";
    });
    expect(fired).toBeTruthy();
    const payload = fired![0] as Record<string, unknown>;
    // requestId fell back to "unknown"
    expect(payload["requestId"]).toBe("unknown");
    // userUid fell back to null (uid was undefined)
    expect(payload["userUid"]).toBeNull();
    info.mockRestore();
  });

  it("T-UP-003d — upload catch falls back to 'upload validation failed' when thrown value has no .message", async () => {
    // Storage mock throws a non-Error value with no `.message` to exercise
    // the `(err as Error).message ?? 'upload validation failed'` fallback
    // branch in products.ts line 47.
    storageBehaviour.signedUrlMode = "throw-non-error";
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const res = await request(buildApp())
      .post("/products/signed-upload")
      .set("x-test-user", CUSTOMER)
      .send({ contentType: "image/jpeg", fileSize: 1024 });
    // Unknown (non-AppError) → 500 via default error handler.
    expect(res.status).toBe(500);
    const fired = info.mock.calls.find((c) => {
      const obj = c[0] as Record<string, unknown> | undefined;
      return obj && (obj as { alert?: { kind?: string } }).alert?.kind === "upload_validation_fail";
    });
    expect(fired).toBeTruthy();
    const payload = fired![0] as Record<string, unknown>;
    expect(payload["message"]).toBe("upload validation failed");
    info.mockRestore();
  });
});

// ══════════════════════════════════════════════════════════════════════
// CTR-003 — POST /products (create)
// ══════════════════════════════════════════════════════════════════════

describe("T-PROD-001..003: POST /products (CTR-003)", () => {
  it("T-PROD-001 — customer creates product → status=pending", async () => {
    const res = await request(buildApp()).post("/products").set("x-test-user", CUSTOMER).send({
      name: "Neon Lullabies",
      artistId: "art-1",
      coverArtPath: "cover-art/uid-cust/123-abc",
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    expect(res.body.ownerUid).toBe("uid-cust");
    expect(res.body.ownerEmail).toBe("cust@example.com");
    expect(res.body.artist).toMatchObject({
      id: "art-1",
      name: "Seed Artist",
      status: "published",
    });
    expect(res.body.approvedAt).toBeUndefined();
    // Response body is a valid Product per the domain schema.
    expect(() => ProductSchema.parse(res.body)).not.toThrow();
    expect(store.size).toBe(1);
  });

  it("T-PROD-002 — admin creates product → status=published, approvedBy set", async () => {
    const res = await request(buildApp()).post("/products").set("x-test-user", ADMIN).send({
      name: "Admin Release",
      artistId: "art-1",
      coverArtPath: "cover-art/uid-admin/1-x",
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("published");
    expect(res.body.approvedBy).toBe("uid-admin");
    expect(typeof res.body.approvedAt).toBe("string");
  });

  it("T-PROD-003 — validation rejects missing name with 400", async () => {
    const res = await request(buildApp())
      .post("/products")
      .set("x-test-user", CUSTOMER)
      .send({ artistId: "art-1", coverArtPath: "p" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("T-PROD-003b — unauthenticated → 401", async () => {
    const res = await request(buildApp())
      .post("/products")
      .send({ name: "X", artistId: "art-1", coverArtPath: "p" });
    expect(res.status).toBe(401);
  });

  it("T-PROD-012 — create rejects a missing artist FK with ARTIST_NOT_FOUND", async () => {
    const res = await request(buildApp()).post("/products").set("x-test-user", CUSTOMER).send({
      name: "Missing Artist Release",
      artistId: "missing-artist",
      coverArtPath: "cover-art/uid-cust/missing",
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("ARTIST_NOT_FOUND");
    expect(res.body.details.artistId).toBe("missing-artist");
  });

  it("T-PROD-013 — customer create rejects a pending artist with ARTIST_NOT_PUBLISHED", async () => {
    seedArtist({ id: "art-pending", status: "pending", name: "Pending Artist" });
    const res = await request(buildApp()).post("/products").set("x-test-user", CUSTOMER).send({
      name: "Pending Artist Release",
      artistId: "art-pending",
      coverArtPath: "cover-art/uid-cust/pending",
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("ARTIST_NOT_PUBLISHED");
    expect(res.body.details.artistId).toBe("art-pending");
  });

  it("T-PROD-014 — admin override creates with a pending artist and emits admin_override", async () => {
    seedArtist({ id: "art-pending", status: "pending", name: "Pending Artist" });
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const res = await request(buildApp()).post("/products").set("x-test-user", ADMIN).send({
      name: "Admin Override Release",
      artistId: "art-pending",
      coverArtPath: "cover-art/uid-admin/pending",
    });
    expect(res.status).toBe(201);
    expect(res.body.artist).toMatchObject({ id: "art-pending", status: "pending" });
    const fired = info.mock.calls.find((c) => {
      const obj = c[0] as Record<string, unknown> | undefined;
      return obj && (obj as { alert?: { kind?: string } }).alert?.kind === "admin_override";
    });
    expect(fired).toBeTruthy();
    const payload = fired![0] as Record<string, unknown>;
    expect(payload["artistId"]).toBe("art-pending");
    expect(payload["adminUid"]).toBe("uid-admin");
    info.mockRestore();
  });
});

// ══════════════════════════════════════════════════════════════════════
// CTR-004 — GET /products (list)
// ══════════════════════════════════════════════════════════════════════

describe("T-PROD-004..006: GET /products (CTR-004)", () => {
  it("T-PROD-004 — customer sees only published products", async () => {
    seedProduct({ id: "p1", status: "published", ownerUid: "other" });
    seedProduct({ id: "p2", status: "pending", ownerUid: "other" });
    seedProduct({ id: "p3", status: "rejected", ownerUid: "other" });
    const res = await request(buildApp()).get("/products").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]!.id).toBe("p1");
  });

  it("T-PROD-005 — admin sees all products by default (no filter)", async () => {
    seedProduct({ id: "p1", status: "published" });
    seedProduct({ id: "p2", status: "pending" });
    seedProduct({ id: "p3", status: "rejected" });
    const res = await request(buildApp()).get("/products").set("x-test-user", ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);
  });

  it("T-PROD-015 — list dereferences the current artist display object", async () => {
    seedArtist({ id: "art-2", name: "Renamed Artist", imageUrl: "https://cdn.example.com/a.jpg" });
    seedProduct({ id: "p1", status: "published", artistId: "art-2" });
    const res = await request(buildApp()).get("/products").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(200);
    expect(res.body.items[0].artist).toEqual({
      id: "art-2",
      name: "Renamed Artist",
      imageUrl: "https://cdn.example.com/a.jpg",
      status: "published",
    });
  });

  it("T-PROD-005b — admin filters by status=pending", async () => {
    seedProduct({ id: "p1", status: "published" });
    seedProduct({ id: "p2", status: "pending" });
    const res = await request(buildApp()).get("/products?status=pending").set("x-test-user", ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]!.status).toBe("pending");
  });

  it("T-PROD-006 — customer with no published products gets empty list (not 404)", async () => {
    seedProduct({ id: "p1", status: "pending" });
    const res = await request(buildApp()).get("/products").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("T-PROD-006b — unauthenticated → 401", async () => {
    const res = await request(buildApp()).get("/products");
    expect(res.status).toBe(401);
  });

  it("T-PROD-006c — Firestore failure surfaces as 500", async () => {
    dbBehaviour.getMode = "throw";
    const res = await request(buildApp()).get("/products").set("x-test-user", ADMIN);
    expect(res.status).toBe(500);
  });
});

// ══════════════════════════════════════════════════════════════════════
// CTR-005 — GET /products/:id (read)
// ══════════════════════════════════════════════════════════════════════

describe("T-PROD-007: GET /products/:id (CTR-005)", () => {
  it("T-PROD-007 — returns a published product to any authenticated user", async () => {
    seedProduct({ id: "p1", status: "published", ownerUid: "other" });
    const res = await request(buildApp()).get("/products/p1").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("p1");
    expect(res.body.artist).toMatchObject({ id: "art-1", name: "Seed Artist" });
  });

  it("T-PROD-007b — owner can read their own pending product", async () => {
    seedProduct({ id: "p1", status: "pending", ownerUid: "uid-cust" });
    const res = await request(buildApp()).get("/products/p1").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("p1");
  });

  it("T-PROD-007c — non-owner non-admin cannot read someone else's pending product (404 hide)", async () => {
    seedProduct({ id: "p1", status: "pending", ownerUid: "other" });
    const res = await request(buildApp()).get("/products/p1").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("T-PROD-007d — admin can read any product regardless of status/owner", async () => {
    seedProduct({ id: "p1", status: "pending", ownerUid: "other" });
    const res = await request(buildApp()).get("/products/p1").set("x-test-user", ADMIN);
    expect(res.status).toBe(200);
  });

  it("T-PROD-007e — missing product → 404", async () => {
    const res = await request(buildApp())
      .get("/products/does-not-exist")
      .set("x-test-user", CUSTOMER);
    expect(res.status).toBe(404);
  });

  it("T-PROD-007f — Firestore failure surfaces as 500", async () => {
    seedProduct({ id: "p1", status: "published" });
    dbBehaviour.getMode = "throw";
    const res = await request(buildApp()).get("/products/p1").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(500);
  });
});

// ══════════════════════════════════════════════════════════════════════
// CTR-006 — PATCH /products/:id (update)
// ══════════════════════════════════════════════════════════════════════

describe("T-PROD-008..009: PATCH /products/:id (CTR-006)", () => {
  it("T-PROD-008 — owner updates name → 200", async () => {
    seedProduct({ id: "p1", name: "Old", ownerUid: "uid-cust" });
    const res = await request(buildApp())
      .patch("/products/p1")
      .set("x-test-user", CUSTOMER)
      .send({ name: "New Name" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("New Name");
    expect(store.get("p1")!.data.name).toBe("New Name");
  });

  it("T-PROD-008b — admin updates any product → 200", async () => {
    seedProduct({ id: "p1", name: "Old", ownerUid: "other" });
    const res = await request(buildApp())
      .patch("/products/p1")
      .set("x-test-user", ADMIN)
      .send({ name: "Admin Edit" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Admin Edit");
  });

  it("T-PROD-008c — partial update with undefined does not clobber existing field", async () => {
    seedProduct({ id: "p1", name: "Keep Me", artistId: "art-1", ownerUid: "uid-cust" });
    seedArtist({ id: "art-2", name: "Updated Artist" });
    const res = await request(buildApp())
      .patch("/products/p1")
      .set("x-test-user", CUSTOMER)
      .send({ artistId: "art-2" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Keep Me");
    expect(res.body.artistId).toBe("art-2");
    expect(res.body.artist.name).toBe("Updated Artist");
  });

  it("T-PROD-014b — admin override updates a product to a pending artist and emits admin_override", async () => {
    seedProduct({ id: "p1", artistId: "art-1", ownerUid: "other" });
    seedArtist({ id: "art-pending", status: "pending", name: "Pending Artist" });
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const res = await request(buildApp())
      .patch("/products/p1")
      .set("x-test-user", ADMIN)
      .send({ artistId: "art-pending" });
    expect(res.status).toBe(200);
    expect(res.body.artist).toMatchObject({ id: "art-pending", status: "pending" });
    const fired = info.mock.calls.find((c) => {
      const obj = c[0] as Record<string, unknown> | undefined;
      return obj && (obj as { alert?: { kind?: string } }).alert?.kind === "admin_override";
    });
    expect(fired).toBeTruthy();
    const payload = fired![0] as Record<string, unknown>;
    expect(payload["productId"]).toBe("p1");
    expect(payload["artistStatus"]).toBe("pending");
    info.mockRestore();
  });

  it("T-PROD-009 — non-owner non-admin → 403 FORBIDDEN", async () => {
    seedProduct({ id: "p1", ownerUid: "uid-cust" });
    const res = await request(buildApp())
      .patch("/products/p1")
      .set("x-test-user", CUSTOMER_B)
      .send({ name: "Hijack" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("T-PROD-009b — missing product → 404", async () => {
    const res = await request(buildApp())
      .patch("/products/missing")
      .set("x-test-user", CUSTOMER)
      .send({ name: "X" });
    expect(res.status).toBe(404);
  });

  it("T-PROD-009c — invalid payload (name too long) → 400", async () => {
    seedProduct({ id: "p1", ownerUid: "uid-cust" });
    const res = await request(buildApp())
      .patch("/products/p1")
      .set("x-test-user", CUSTOMER)
      .send({ name: "x".repeat(121) });
    expect(res.status).toBe(400);
  });

  it("T-PROD-012b — update rejects a missing artist FK with ARTIST_NOT_FOUND", async () => {
    seedProduct({ id: "p1", ownerUid: "uid-cust" });
    const res = await request(buildApp())
      .patch("/products/p1")
      .set("x-test-user", CUSTOMER)
      .send({ artistId: "missing-artist" });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("ARTIST_NOT_FOUND");
  });

  it("T-PROD-013b — customer update rejects a pending artist with ARTIST_NOT_PUBLISHED", async () => {
    seedProduct({ id: "p1", ownerUid: "uid-cust" });
    seedArtist({ id: "art-pending", status: "pending", name: "Pending Artist" });
    const res = await request(buildApp())
      .patch("/products/p1")
      .set("x-test-user", CUSTOMER)
      .send({ artistId: "art-pending" });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("ARTIST_NOT_PUBLISHED");
  });
});

// ══════════════════════════════════════════════════════════════════════
// CTR-007 — DELETE /products/:id
// ══════════════════════════════════════════════════════════════════════

describe("T-PROD-010..011: DELETE /products/:id (CTR-007)", () => {
  it("T-PROD-010 — owner deletes product → 204 + Storage object deleted", async () => {
    seedProduct({
      id: "p1",
      coverArtPath: "cover-art/uid-cust/p1-cover.jpg",
      ownerUid: "uid-cust",
    });
    const res = await request(buildApp()).delete("/products/p1").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(204);
    expect(store.has("p1")).toBe(false);
    expect(objectDeleteCalls).toContain("cover-art/uid-cust/p1-cover.jpg");
  });

  it("T-PROD-010b — admin deletes any product → 204", async () => {
    seedProduct({ id: "p1", ownerUid: "other" });
    const res = await request(buildApp()).delete("/products/p1").set("x-test-user", ADMIN);
    expect(res.status).toBe(204);
  });

  it("T-PROD-010c — Storage delete failure does NOT fail the request (best-effort)", async () => {
    seedProduct({ id: "p1", ownerUid: "uid-cust" });
    storageBehaviour.objectDeleteMode = "throw";
    const res = await request(buildApp()).delete("/products/p1").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(204);
    expect(store.has("p1")).toBe(false); // Firestore delete still succeeded
  });

  it("T-PROD-011 — non-owner non-admin → 403", async () => {
    seedProduct({ id: "p1", ownerUid: "uid-cust" });
    const res = await request(buildApp()).delete("/products/p1").set("x-test-user", CUSTOMER_B);
    expect(res.status).toBe(403);
    expect(store.has("p1")).toBe(true); // unchanged
  });

  it("T-PROD-011b — missing product → 404", async () => {
    const res = await request(buildApp()).delete("/products/missing").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(404);
  });
});

// ══════════════════════════════════════════════════════════════════════
// CTR-008 — POST /products/:id/approve  (admin only)
// ══════════════════════════════════════════════════════════════════════

describe("T-ADMIN-001..002: POST /products/:id/approve (CTR-008)", () => {
  it("T-ADMIN-001 — admin approves pending → status=published, approvedBy set", async () => {
    seedProduct({ id: "p1", status: "pending" });
    const res = await request(buildApp())
      .post("/products/p1/approve")
      .set("x-test-user", ADMIN)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("published");
    expect(res.body.approvedBy).toBe("uid-admin");
    expect(typeof res.body.approvedAt).toBe("string");
  });

  it("T-ADMIN-001b — customer cannot approve → 403", async () => {
    seedProduct({ id: "p1", status: "pending" });
    const res = await request(buildApp())
      .post("/products/p1/approve")
      .set("x-test-user", CUSTOMER)
      .send({});
    expect(res.status).toBe(403);
  });

  it("T-ADMIN-001c — unauthenticated → 401", async () => {
    const res = await request(buildApp()).post("/products/p1/approve").send({});
    expect(res.status).toBe(401);
  });

  it("T-ADMIN-002 — approving already-published → 409 CONFLICT", async () => {
    seedProduct({ id: "p1", status: "published" });
    const res = await request(buildApp())
      .post("/products/p1/approve")
      .set("x-test-user", ADMIN)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
  });

  it("T-ADMIN-002b — approve missing product → 404", async () => {
    const res = await request(buildApp())
      .post("/products/missing/approve")
      .set("x-test-user", ADMIN)
      .send({});
    expect(res.status).toBe(404);
  });

  it("T-ADMIN-002c — emits alert.kind=admin_action on approve", async () => {
    seedProduct({ id: "p1", status: "pending" });
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await request(buildApp()).post("/products/p1/approve").set("x-test-user", ADMIN).send({});
    const fired = info.mock.calls.find((c) => {
      const obj = c[0] as Record<string, unknown> | undefined;
      return obj && (obj as { alert?: { kind?: string } }).alert?.kind === "admin_action";
    });
    expect(fired).toBeTruthy();
    info.mockRestore();
  });
});

// ══════════════════════════════════════════════════════════════════════
// CTR-009 — POST /products/:id/reject  (admin only)
// ══════════════════════════════════════════════════════════════════════

describe("T-ADMIN-003: POST /products/:id/reject (CTR-009)", () => {
  it("T-ADMIN-003 — admin rejects with reason → status=rejected, reason stored", async () => {
    seedProduct({ id: "p1", status: "pending" });
    const res = await request(buildApp())
      .post("/products/p1/reject")
      .set("x-test-user", ADMIN)
      .send({ reason: "Cover art breaches guidelines" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("rejected");
    expect(res.body.rejectionReason).toBe("Cover art breaches guidelines");
  });

  it("T-ADMIN-003b — default reason applied when body omits reason", async () => {
    seedProduct({ id: "p1", status: "pending" });
    const res = await request(buildApp())
      .post("/products/p1/reject")
      .set("x-test-user", ADMIN)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.rejectionReason).toBe("Rejected by admin");
  });

  it("T-ADMIN-003c — default reason when reason is non-string", async () => {
    seedProduct({ id: "p1", status: "pending" });
    const res = await request(buildApp())
      .post("/products/p1/reject")
      .set("x-test-user", ADMIN)
      .send({ reason: 12345 });
    expect(res.status).toBe(200);
    expect(res.body.rejectionReason).toBe("Rejected by admin");
  });

  it("T-ADMIN-003d — customer cannot reject → 403", async () => {
    seedProduct({ id: "p1", status: "pending" });
    const res = await request(buildApp())
      .post("/products/p1/reject")
      .set("x-test-user", CUSTOMER)
      .send({});
    expect(res.status).toBe(403);
  });

  it("T-ADMIN-003e — reject missing product → 404", async () => {
    const res = await request(buildApp())
      .post("/products/missing/reject")
      .set("x-test-user", ADMIN)
      .send({});
    expect(res.status).toBe(404);
  });

  it("T-ADMIN-003f — reject handles missing body gracefully", async () => {
    seedProduct({ id: "p1", status: "pending" });
    const res = await request(buildApp()).post("/products/p1/reject").set("x-test-user", ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.rejectionReason).toBe("Rejected by admin");
  });
});
