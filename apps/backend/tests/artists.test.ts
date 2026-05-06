/* eslint-disable import/order -- mirror products.test.ts grouping */
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { describe, expect, it, vi, beforeEach } from "vitest";

import type { Env } from "../src/config/env.js";
import { AppError } from "../src/domain/errors.js";
import { ArtistSchema, type Artist } from "../src/domain/artist.js";
import { errorHandler, notFoundHandler } from "../src/middleware/error.js";
import { requestIdMiddleware } from "../src/middleware/requestId.js";
/* eslint-enable import/order */

/**
 * Tests for the Artists CRUD endpoints (CTR-100..105).
 *
 * Scenario coverage:
 *   T-ARTIST-UP-001..003   Signed-upload reuse (CTR-100)
 *   T-ARTIST-001..006      Create (CTR-101) — admin/customer status, uniqueness, slug derive
 *   T-ARTIST-007..014      List (CTR-102) — RBAC scope, status filter (single + comma list), ownerUid
 *   T-ARTIST-015..018      Read one (CTR-103) — RBAC + 404-hide
 *   T-ARTIST-019..023      Update (CTR-104) — owner/admin, rename triggers slug regen + uniqueness
 *   T-ARTIST-024..030      Delete (CTR-105) — RBAC + FK delete-block 409 + image cleanup
 */

// ─── Controllable Firestore + Storage state ────────────────────────────
type ArtistRec = { data: Artist };
const store: Map<string, ArtistRec> = new Map();
// Separate "products" store so the FK delete-block check can find blockers.
type ProductRec = { id: string; artistId: string };
const productStore: Map<string, ProductRec> = new Map();

const storageBehaviour: {
  signedUrlMode: "ok" | "throw" | "throw-non-error";
  objectDeleteMode: "ok" | "throw";
} = {
  signedUrlMode: "ok",
  objectDeleteMode: "ok",
};

// When set to "throw", the artists collection's `.get()` (used by LIST) raises.
// This is the only place we need a controllable DB failure for branch coverage.
const dbBehaviour: { listMode: "ok" | "throw" } = { listMode: "ok" };

const objectDeleteCalls: string[] = [];
let docCounter = 0;
const mintId = () => `art-${++docCounter}`;

vi.mock("../src/lib/firebase.js", () => {
  type Filter = { field: string; op: string; value: unknown };

  const makeArtistDocRef = (id: string) => ({
    id,
    get: async () => {
      const rec = store.get(id);
      return { exists: !!rec, data: () => rec?.data };
    },
    set: async (data: Artist) => {
      store.set(id, { data });
    },
    delete: async () => {
      store.delete(id);
    },
  });

  const matchesFilters = (rec: { data: Record<string, unknown> }, filters: Filter[]): boolean =>
    filters.every((f) => {
      const v = rec.data[f.field];
      if (f.op === "==") return v === f.value;
      if (f.op === "in") return Array.isArray(f.value) && (f.value as unknown[]).includes(v);
      return false;
    });

  // Query builder for the artists collection (and the products collection's
  // `artistId` lookup used by the delete-block check).
  const makeArtistQuery = (filters: Filter[] = [], cap = Number.POSITIVE_INFINITY) => ({
    orderBy: () => makeArtistQuery(filters, cap),
    limit: (n: number) => makeArtistQuery(filters, n),
    where: (field: string, op: string, value: unknown) =>
      makeArtistQuery([...filters, { field, op, value }], cap),
    get: async () => {
      if (dbBehaviour.listMode === "throw") {
        throw new Error("simulated firestore failure");
      }
      const rows = Array.from(store.entries())
        .filter(([, rec]) =>
          matchesFilters({ data: rec.data as unknown as Record<string, unknown> }, filters)
        )
        .map(([id, rec]) => ({ id, data: () => rec.data }));
      const sliced = rows.slice(0, cap);
      return { empty: sliced.length === 0, size: sliced.length, docs: sliced };
    },
  });

  const makeProductQuery = (filters: Filter[] = [], cap = Number.POSITIVE_INFINITY) => ({
    where: (field: string, op: string, value: unknown) =>
      makeProductQuery([...filters, { field, op, value }], cap),
    limit: (n: number) => makeProductQuery(filters, n),
    get: async () => {
      const rows = Array.from(productStore.values())
        .filter((rec) =>
          matchesFilters({ data: rec as unknown as Record<string, unknown> }, filters)
        )
        .map((rec) => ({ id: rec.id }));
      const sliced = rows.slice(0, cap);
      return { empty: sliced.length === 0, size: sliced.length, docs: sliced };
    },
  });

  const collection = (name: string) => {
    if (name === "products") {
      return {
        doc: (id?: string) => ({ id: id ?? "p?" }),
        where: makeProductQuery().where,
      };
    }
    // default: artists
    return {
      doc: (id?: string) => makeArtistDocRef(id ?? mintId()),
      orderBy: makeArtistQuery().orderBy,
      limit: makeArtistQuery().limit,
      where: makeArtistQuery().where,
    };
  };

  // Run a transaction by passing the caller a `txn` whose `get` and `set`
  // delegate to the same in-memory store. No real isolation needed for tests.
  const runTransaction = async <T>(
    fn: (txn: {
      get: (q: { get: () => Promise<unknown> }) => Promise<unknown>;
      set: (ref: { id: string }, data: Artist) => void;
    }) => Promise<T>
  ): Promise<T> =>
    fn({
      get: (q: { get: () => Promise<unknown> }) => q.get(),
      set: (ref: { id: string }, data: Artist) => {
        store.set(ref.id, { data });
      },
    });

  return {
    db: () => ({ collection, runTransaction }),
    bucket: () => ({
      file: (objectPath: string) => ({
        getSignedUrl: async (opts: { contentType: string }) => {
          if (storageBehaviour.signedUrlMode === "throw") {
            throw new Error("signed url generation failed");
          }
          if (storageBehaviour.signedUrlMode === "throw-non-error") {
            // Throw a non-Error to exercise the
            // `(err as Error).message ?? "upload validation failed"` fallback
            // branch in routes/artists.ts (mirrors products.ts coverage).
            throw { notAnError: true } as unknown;
          }
          return [`https://storage.example.com/${objectPath}?sig=test&ct=${opts.contentType}`];
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
type AuthMiddlewareModule = {
  requireAuth: unknown;
  requireRole: unknown;
};
vi.mock("../src/middleware/auth.js", async (importActual) => {
  const actual = (await importActual()) as AuthMiddlewareModule;
  return {
    requireRole: actual.requireRole,
    requireAuth: () => (req: Request, _res: Response, next: NextFunction) => {
      const header = req.header("x-test-user");
      if (!header) {
        next(new AppError(401, "UNAUTHENTICATED", "Missing test user"));
        return;
      }
      // Special marker: `__no-uid__` builds a user object with no uid,
      // exercising the `req.user?.uid ?? null` fallback branch in
      // routes/artists.ts (line 68).
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
import { artistsRouter } from "../src/routes/artists.js";

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
  app.use("/artists", artistsRouter(stubEnv));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};

const CUSTOMER = "uid-cust:customer:cust@example.com";
const CUSTOMER_B = "uid-cust-b:customer:custb@example.com";
const ADMIN = "uid-admin:admin:admin@example.com";

const seedArtist = (overrides: Partial<Artist> = {}): Artist => {
  const id = overrides.id ?? mintId();
  const now = new Date().toISOString();
  const name = overrides.name ?? "Seed Artist";
  const a: Artist = {
    id,
    name,
    name_lc: overrides.name_lc ?? name.trim().toLowerCase(),
    slug: overrides.slug ?? name.trim().toLowerCase().replace(/\s+/g, "-"),
    status: "pending",
    ownerUid: "uid-cust",
    ownerEmail: "cust@example.com",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  store.set(id, { data: a });
  return a;
};

const seedProduct = (id: string, artistId: string) => {
  productStore.set(id, { id, artistId });
};

beforeEach(() => {
  store.clear();
  productStore.clear();
  objectDeleteCalls.length = 0;
  docCounter = 0;
  storageBehaviour.signedUrlMode = "ok";
  storageBehaviour.objectDeleteMode = "ok";
  dbBehaviour.listMode = "ok";
});

// ══════════════════════════════════════════════════════════════════════
// CTR-100 — Signed upload
// ══════════════════════════════════════════════════════════════════════

describe("T-ARTIST-UP-001..003: POST /artists/signed-upload (CTR-100)", () => {
  it("T-ARTIST-UP-001 — unauthenticated → 401", async () => {
    const res = await request(buildApp())
      .post("/artists/signed-upload")
      .send({ contentType: "image/jpeg", fileSize: 1024 });
    expect(res.status).toBe(401);
  });

  it("T-ARTIST-UP-002 — happy path returns signed URL with artist-images prefix", async () => {
    const res = await request(buildApp())
      .post("/artists/signed-upload")
      .set("x-test-user", CUSTOMER)
      .send({ contentType: "image/png", fileSize: 1024 });
    expect(res.status).toBe(201);
    expect(res.body.objectPath).toMatch(/^artist-images\/uid-cust\/\d+-/);
    expect(res.body.uploadUrl).toContain("ct=image/png");
  });

  it("T-ARTIST-UP-003 — rejects non-image content type with 400", async () => {
    const res = await request(buildApp())
      .post("/artists/signed-upload")
      .set("x-test-user", CUSTOMER)
      .send({ contentType: "application/pdf", fileSize: 1024 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("T-ARTIST-UP-003b — Storage failure forwarded as 500 + emits upload_validation_fail", async () => {
    storageBehaviour.signedUrlMode = "throw";
    const res = await request(buildApp())
      .post("/artists/signed-upload")
      .set("x-test-user", CUSTOMER)
      .send({ contentType: "image/jpeg", fileSize: 1024 });
    expect(res.status).toBe(500);
  });

  it("T-ARTIST-UP-003c — non-Error thrown from storage falls back to default message", async () => {
    // Exercises the `(err as Error).message ?? 'upload validation failed'`
    // fallback branch in routes/artists.ts when the underlying error has no
    // `.message` field.
    storageBehaviour.signedUrlMode = "throw-non-error";
    const res = await request(buildApp())
      .post("/artists/signed-upload")
      .set("x-test-user", CUSTOMER)
      .send({ contentType: "image/jpeg", fileSize: 1024 });
    // Default error handler maps unknown throw → 500.
    expect(res.status).toBe(500);
  });

  it("T-ARTIST-UP-003d — emit-alert fallbacks trigger when requestId and user.uid are absent", async () => {
    // Build an app WITHOUT requestIdMiddleware to exercise the
    // `req.requestId ?? "unknown"` fallback (routes/artists.ts line 67) and
    // use the special `__no-uid__` marker to set a user with `uid=undefined`,
    // exercising the `req.user?.uid ?? null` fallback (line 68).
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const app = express();
    app.use(express.json());
    // No requestIdMiddleware.
    app.use("/artists", artistsRouter(stubEnv));
    app.use(notFoundHandler);
    app.use(errorHandler);

    const res = await request(app)
      .post("/artists/signed-upload")
      .set("x-test-user", "__no-uid__")
      .send({ contentType: "application/pdf", fileSize: 1024 });
    expect(res.status).toBe(400);
    const fired = info.mock.calls.find((c) => {
      const obj = c[0] as Record<string, unknown> | undefined;
      return obj && (obj as { alert?: { kind?: string } }).alert?.kind === "upload_validation_fail";
    });
    expect(fired).toBeTruthy();
    const payload = fired![0] as Record<string, unknown>;
    expect(payload["requestId"]).toBe("unknown");
    expect(payload["userUid"]).toBeNull();
    info.mockRestore();
  });
});

// ══════════════════════════════════════════════════════════════════════
// CTR-101 — Create
// ══════════════════════════════════════════════════════════════════════

describe("T-ARTIST-001..006: POST /artists (CTR-101)", () => {
  it("T-ARTIST-001 — customer create → status pending; name_lc + slug derived", async () => {
    const res = await request(buildApp())
      .post("/artists")
      .set("x-test-user", CUSTOMER)
      .send({ name: "Aurora Borealis" });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    expect(res.body.name).toBe("Aurora Borealis");
    expect(res.body.name_lc).toBe("aurora borealis");
    expect(res.body.slug).toBe("aurora-borealis");
    expect(res.body.ownerUid).toBe("uid-cust");
    expect(res.body.approvedAt).toBeUndefined();
    // Schema parse passes
    expect(() => ArtistSchema.parse(res.body)).not.toThrow();
  });

  it("T-ARTIST-002 — admin create → status published, approvedBy set", async () => {
    const res = await request(buildApp())
      .post("/artists")
      .set("x-test-user", ADMIN)
      .send({ name: "Admin Picked", bio: "A short bio.", country: "NL" });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("published");
    expect(res.body.approvedBy).toBe("uid-admin");
    expect(res.body.bio).toBe("A short bio.");
    expect(res.body.country).toBe("NL");
  });

  it("T-ARTIST-003 — validation rejects missing name with 400", async () => {
    const res = await request(buildApp()).post("/artists").set("x-test-user", CUSTOMER).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("T-ARTIST-004 — name uniqueness: case-insensitive collision → 409", async () => {
    seedArtist({
      id: "a1",
      name: "Aurora",
      name_lc: "aurora",
      slug: "aurora",
      status: "published",
    });
    const res = await request(buildApp())
      .post("/artists")
      .set("x-test-user", CUSTOMER)
      .send({ name: "AURORA" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(res.body.message).toMatch(/already exists/);
  });

  it("T-ARTIST-005 — slug uniqueness collision (different name, same slug) → 409", async () => {
    // Pre-seed with slug 'aurora'
    seedArtist({
      id: "a1",
      name: "Aurora",
      name_lc: "aurora",
      slug: "aurora",
      status: "published",
    });
    // New name normalises to a different name_lc but the same slug
    // (e.g. "  Aurora  " has different surrounding whitespace but identical slug).
    // We force the case by using "Aurora!" → name_lc="aurora!" but slug="aurora".
    const res = await request(buildApp())
      .post("/artists")
      .set("x-test-user", CUSTOMER)
      .send({ name: "Aurora!" });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/slug/);
  });

  it("T-ARTIST-006 — invalid country code (not ISO 3166-1 alpha-2) → 400", async () => {
    const res = await request(buildApp())
      .post("/artists")
      .set("x-test-user", CUSTOMER)
      .send({ name: "X", country: "Netherlands" });
    expect(res.status).toBe(400);
  });

  it("T-ARTIST-006b — name with only emoji yields a fallback slug 'artist'", async () => {
    const res = await request(buildApp())
      .post("/artists")
      .set("x-test-user", CUSTOMER)
      .send({ name: "✨🎵" });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe("artist");
  });

  it("T-ARTIST-006c — create with imageObjectPath persists it on the artist doc", async () => {
    const res = await request(buildApp())
      .post("/artists")
      .set("x-test-user", CUSTOMER)
      .send({ name: "With Image", imageObjectPath: "artist-images/uid-cust/abc.jpg" });
    expect(res.status).toBe(201);
    expect(res.body.imageObjectPath).toBe("artist-images/uid-cust/abc.jpg");
    expect(res.body.imageUrl).toBe(
      "https://firebasestorage.googleapis.com/v0/b/muga-test.appspot.com/o/artist-images%2Fuid-cust%2Fabc.jpg?alt=media"
    );
  });

  it("T-ARTIST-006d — stored imageUrl takes precedence over imageObjectPath", async () => {
    const res = await request(buildApp()).post("/artists").set("x-test-user", CUSTOMER).send({
      name: "With Existing Image URL",
      imageObjectPath: "artist-images/uid-cust/ignored.jpg",
    });
    const id = res.body.id as string;
    const rec = store.get(id)!;
    store.set(id, { data: { ...rec.data, imageUrl: "https://cdn.example.com/artist.jpg" } });

    const read = await request(buildApp()).get(`/artists/${id}`).set("x-test-user", CUSTOMER);

    expect(read.status).toBe(200);
    expect(read.body.imageUrl).toBe("https://cdn.example.com/artist.jpg");
  });
});

// ══════════════════════════════════════════════════════════════════════
// CTR-102 — List
// ══════════════════════════════════════════════════════════════════════

describe("T-ARTIST-007..014: GET /artists (CTR-102)", () => {
  it("T-ARTIST-007 — customer sees only published by default", async () => {
    seedArtist({
      id: "a1",
      imageObjectPath: "artist-images/other/a1.jpg",
      status: "published",
      ownerUid: "other",
    });
    seedArtist({ id: "a2", status: "pending", ownerUid: "other" });
    seedArtist({ id: "a3", status: "rejected", ownerUid: "other" });
    const res = await request(buildApp()).get("/artists").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe("a1");
    expect(res.body.items[0].imageUrl).toBe(
      "https://firebasestorage.googleapis.com/v0/b/muga-test.appspot.com/o/artist-images%2Fother%2Fa1.jpg?alt=media"
    );
  });

  it("T-ARTIST-008 — admin without filter sees all", async () => {
    seedArtist({ id: "a1", status: "published" });
    seedArtist({ id: "a2", status: "pending" });
    seedArtist({ id: "a3", status: "rejected" });
    const res = await request(buildApp()).get("/artists").set("x-test-user", ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);
  });

  it("T-ARTIST-009 — admin status=pending (single value)", async () => {
    seedArtist({ id: "a1", status: "published" });
    seedArtist({ id: "a2", status: "pending" });
    const res = await request(buildApp()).get("/artists?status=pending").set("x-test-user", ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].status).toBe("pending");
  });

  it("T-ARTIST-010 — admin status=pending,rejected (comma list)", async () => {
    seedArtist({ id: "a1", status: "published" });
    seedArtist({ id: "a2", status: "pending" });
    seedArtist({ id: "a3", status: "rejected" });
    const res = await request(buildApp())
      .get("/artists?status=pending,rejected")
      .set("x-test-user", ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
  });

  it("T-ARTIST-011 — empty/whitespace status filter is ignored (admin sees all)", async () => {
    seedArtist({ id: "a1", status: "published" });
    seedArtist({ id: "a2", status: "pending" });
    const res = await request(buildApp()).get("/artists?status=").set("x-test-user", ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
  });

  it("T-ARTIST-011b — status filter with only unknown values is ignored (admin sees all)", async () => {
    seedArtist({ id: "a1", status: "published" });
    seedArtist({ id: "a2", status: "pending" });
    const res = await request(buildApp())
      .get("/artists?status=banana,kiwi")
      .set("x-test-user", ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
  });

  it("T-ARTIST-012 — admin filters by ownerUid", async () => {
    seedArtist({ id: "a1", ownerUid: "uid-x", status: "published" });
    seedArtist({ id: "a2", ownerUid: "uid-y", status: "published" });
    const res = await request(buildApp()).get("/artists?ownerUid=uid-x").set("x-test-user", ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].ownerUid).toBe("uid-x");
  });

  it("T-ARTIST-013 — customer scoping with ownerUid=self sees own artists at any status", async () => {
    seedArtist({ id: "a1", ownerUid: "uid-cust", status: "pending" });
    seedArtist({ id: "a2", ownerUid: "uid-cust", status: "rejected" });
    seedArtist({ id: "a3", ownerUid: "other", status: "pending" });
    const res = await request(buildApp())
      .get("/artists?ownerUid=uid-cust&status=pending,rejected")
      .set("x-test-user", CUSTOMER);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.every((a: Artist) => a.ownerUid === "uid-cust")).toBe(true);
  });

  it("T-ARTIST-013b — customer scoping with ownerUid=self + single status filter", async () => {
    seedArtist({ id: "a1", ownerUid: "uid-cust", status: "pending" });
    seedArtist({ id: "a2", ownerUid: "uid-cust", status: "published" });
    const res = await request(buildApp())
      .get("/artists?ownerUid=uid-cust&status=pending")
      .set("x-test-user", CUSTOMER);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].status).toBe("pending");
  });

  it("T-ARTIST-014 — customer requesting someone else's ownerUid silently scoped to published-only", async () => {
    seedArtist({ id: "a1", ownerUid: "other", status: "published" });
    seedArtist({ id: "a2", ownerUid: "other", status: "pending" });
    const res = await request(buildApp())
      .get("/artists?ownerUid=other")
      .set("x-test-user", CUSTOMER);
    expect(res.status).toBe(200);
    // Customer's `?ownerUid=other` is ignored; default-published rule applies.
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe("a1");
  });

  it("T-ARTIST-014b — unauthenticated → 401", async () => {
    const res = await request(buildApp()).get("/artists");
    expect(res.status).toBe(401);
  });

  it("T-ARTIST-014c — Firestore failure during list is forwarded to the error handler", async () => {
    dbBehaviour.listMode = "throw";
    const res = await request(buildApp()).get("/artists").set("x-test-user", ADMIN);
    expect(res.status).toBe(500);
  });
});

// ══════════════════════════════════════════════════════════════════════
// CTR-103 — Read one
// ══════════════════════════════════════════════════════════════════════

describe("T-ARTIST-015..018: GET /artists/:id (CTR-103)", () => {
  it("T-ARTIST-015 — published artist visible to any authenticated user", async () => {
    seedArtist({
      id: "a1",
      imageObjectPath: "artist-images/other/read.jpg",
      status: "published",
      ownerUid: "other",
    });
    const res = await request(buildApp()).get("/artists/a1").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("a1");
    expect(res.body.imageUrl).toBe(
      "https://firebasestorage.googleapis.com/v0/b/muga-test.appspot.com/o/artist-images%2Fother%2Fread.jpg?alt=media"
    );
  });

  it("T-ARTIST-016 — owner can read own pending artist", async () => {
    seedArtist({ id: "a1", status: "pending", ownerUid: "uid-cust" });
    const res = await request(buildApp()).get("/artists/a1").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(200);
  });

  it("T-ARTIST-017 — non-owner non-admin pending → 404 hide", async () => {
    seedArtist({ id: "a1", status: "pending", ownerUid: "other" });
    const res = await request(buildApp()).get("/artists/a1").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(404);
  });

  it("T-ARTIST-017b — admin can read any pending artist", async () => {
    seedArtist({ id: "a1", status: "pending", ownerUid: "other" });
    const res = await request(buildApp()).get("/artists/a1").set("x-test-user", ADMIN);
    expect(res.status).toBe(200);
  });

  it("T-ARTIST-018 — missing artist → 404", async () => {
    const res = await request(buildApp()).get("/artists/nonexistent").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(404);
  });
});

// ══════════════════════════════════════════════════════════════════════
// CTR-104 — Update
// ══════════════════════════════════════════════════════════════════════

describe("T-ARTIST-019..023: PATCH /artists/:id (CTR-104)", () => {
  it("T-ARTIST-019 — owner updates bio (no rename) → 200", async () => {
    seedArtist({
      id: "a1",
      ownerUid: "uid-cust",
      name: "Aurora",
      name_lc: "aurora",
      slug: "aurora",
    });
    const res = await request(buildApp())
      .patch("/artists/a1")
      .set("x-test-user", CUSTOMER)
      .send({ bio: "Now with bio" });
    expect(res.status).toBe(200);
    expect(res.body.bio).toBe("Now with bio");
    // No rename → name_lc + slug unchanged
    expect(res.body.name_lc).toBe("aurora");
    expect(res.body.slug).toBe("aurora");
  });

  it("T-ARTIST-020 — admin updates any artist → 200", async () => {
    seedArtist({
      id: "a1",
      ownerUid: "other",
      name: "Old Name",
      name_lc: "old name",
      slug: "old-name",
    });
    const res = await request(buildApp())
      .patch("/artists/a1")
      .set("x-test-user", ADMIN)
      .send({ bio: "Admin edit" });
    expect(res.status).toBe(200);
    expect(res.body.bio).toBe("Admin edit");
  });

  it("T-ARTIST-021 — non-owner non-admin → 403", async () => {
    seedArtist({ id: "a1", ownerUid: "uid-cust" });
    const res = await request(buildApp())
      .patch("/artists/a1")
      .set("x-test-user", CUSTOMER_B)
      .send({ bio: "hijack" });
    expect(res.status).toBe(403);
  });

  it("T-ARTIST-021b — missing artist → 404", async () => {
    const res = await request(buildApp())
      .patch("/artists/missing")
      .set("x-test-user", CUSTOMER)
      .send({ bio: "x" });
    expect(res.status).toBe(404);
  });

  it("T-ARTIST-022 — rename regenerates name_lc + slug; uniqueness re-checked", async () => {
    seedArtist({
      id: "a1",
      ownerUid: "uid-cust",
      name: "Aurora",
      name_lc: "aurora",
      slug: "aurora",
    });
    const res = await request(buildApp())
      .patch("/artists/a1")
      .set("x-test-user", CUSTOMER)
      .send({ name: "Aurora Borealis" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Aurora Borealis");
    expect(res.body.name_lc).toBe("aurora borealis");
    expect(res.body.slug).toBe("aurora-borealis");
  });

  it("T-ARTIST-022b — rename to a name that collides with another artist → 409", async () => {
    seedArtist({
      id: "a1",
      ownerUid: "uid-cust",
      name: "Aurora",
      name_lc: "aurora",
      slug: "aurora",
    });
    seedArtist({
      id: "a2",
      ownerUid: "other",
      name: "Borealis",
      name_lc: "borealis",
      slug: "borealis",
      status: "published",
    });
    const res = await request(buildApp())
      .patch("/artists/a1")
      .set("x-test-user", CUSTOMER)
      .send({ name: "Borealis" });
    expect(res.status).toBe(409);
  });

  it("T-ARTIST-023 — patch with same name as existing (self) is allowed (excludeId path)", async () => {
    seedArtist({
      id: "a1",
      ownerUid: "uid-cust",
      name: "Aurora",
      name_lc: "aurora",
      slug: "aurora",
    });
    // PATCH name to the SAME value triggers the no-rename branch.
    const res = await request(buildApp())
      .patch("/artists/a1")
      .set("x-test-user", CUSTOMER)
      .send({ name: "Aurora" });
    expect(res.status).toBe(200);
  });

  it("T-ARTIST-023b — invalid country code in patch → 400", async () => {
    seedArtist({ id: "a1", ownerUid: "uid-cust" });
    const res = await request(buildApp())
      .patch("/artists/a1")
      .set("x-test-user", CUSTOMER)
      .send({ country: "Netherlands" });
    expect(res.status).toBe(400);
  });
});

// ══════════════════════════════════════════════════════════════════════
// CTR-105 — Delete
// ══════════════════════════════════════════════════════════════════════

describe("T-ARTIST-024..030: DELETE /artists/:id (CTR-105)", () => {
  it("T-ARTIST-024 — owner deletes artist with no products → 204", async () => {
    seedArtist({ id: "a1", ownerUid: "uid-cust" });
    const res = await request(buildApp()).delete("/artists/a1").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(204);
    expect(store.has("a1")).toBe(false);
  });

  it("T-ARTIST-024b — admin deletes any artist → 204", async () => {
    seedArtist({ id: "a1", ownerUid: "other" });
    const res = await request(buildApp()).delete("/artists/a1").set("x-test-user", ADMIN);
    expect(res.status).toBe(204);
  });

  it("T-ARTIST-024c — also deletes the image object best-effort", async () => {
    seedArtist({
      id: "a1",
      ownerUid: "uid-cust",
      imageObjectPath: "artist-images/uid-cust/img.jpg",
    });
    const res = await request(buildApp()).delete("/artists/a1").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(204);
    expect(objectDeleteCalls).toContain("artist-images/uid-cust/img.jpg");
  });

  it("T-ARTIST-024d — image-delete failure does NOT fail the request (best-effort)", async () => {
    seedArtist({
      id: "a1",
      ownerUid: "uid-cust",
      imageObjectPath: "artist-images/uid-cust/img.jpg",
    });
    storageBehaviour.objectDeleteMode = "throw";
    const res = await request(buildApp()).delete("/artists/a1").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(204);
    expect(store.has("a1")).toBe(false);
  });

  it("T-ARTIST-025 — non-owner non-admin → 403", async () => {
    seedArtist({ id: "a1", ownerUid: "uid-cust" });
    const res = await request(buildApp()).delete("/artists/a1").set("x-test-user", CUSTOMER_B);
    expect(res.status).toBe(403);
    expect(store.has("a1")).toBe(true);
  });

  it("T-ARTIST-025b — missing artist → 404", async () => {
    const res = await request(buildApp()).delete("/artists/missing").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(404);
  });

  it("T-ARTIST-026 — delete blocked by 1 referencing product → 409 with details", async () => {
    seedArtist({ id: "a1", ownerUid: "uid-cust" });
    seedProduct("p1", "a1");
    const res = await request(buildApp()).delete("/artists/a1").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(res.body.details.blockingProductIds).toEqual(["p1"]);
    expect(res.body.details.hasMore).toBe(false);
    // Artist still exists
    expect(store.has("a1")).toBe(true);
  });

  it("T-ARTIST-027 — exactly 5 referencing products → returns all 5, hasMore false", async () => {
    seedArtist({ id: "a1", ownerUid: "uid-cust" });
    for (let i = 1; i <= 5; i++) seedProduct(`p${i}`, "a1");
    const res = await request(buildApp()).delete("/artists/a1").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(409);
    expect(res.body.details.blockingProductIds).toHaveLength(5);
    expect(res.body.details.hasMore).toBe(false);
  });

  it("T-ARTIST-028 — 6 referencing products → returns 5, hasMore true", async () => {
    seedArtist({ id: "a1", ownerUid: "uid-cust" });
    for (let i = 1; i <= 6; i++) seedProduct(`p${i}`, "a1");
    const res = await request(buildApp()).delete("/artists/a1").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(409);
    expect(res.body.details.blockingProductIds).toHaveLength(5);
    expect(res.body.details.hasMore).toBe(true);
  });

  it("T-ARTIST-029 — admin deleting an artist with products is also blocked", async () => {
    seedArtist({ id: "a1", ownerUid: "other" });
    seedProduct("p1", "a1");
    const res = await request(buildApp()).delete("/artists/a1").set("x-test-user", ADMIN);
    expect(res.status).toBe(409);
  });

  it("T-ARTIST-030 — delete on artist without imageObjectPath does not call storage delete", async () => {
    seedArtist({ id: "a1", ownerUid: "uid-cust" });
    const res = await request(buildApp()).delete("/artists/a1").set("x-test-user", CUSTOMER);
    expect(res.status).toBe(204);
    expect(objectDeleteCalls).toHaveLength(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// CTR-106 / CTR-107 — Admin moderation (approve / reject)
// ══════════════════════════════════════════════════════════════════════

describe("T-ARTIST-031..036: POST /artists/:id/approve|reject (CTR-106, CTR-107)", () => {
  // ─── CTR-106 — approve ───────────────────────────────────────────────

  it("T-ARTIST-031 — admin approves a pending artist → status=published, approvedAt+By set", async () => {
    seedArtist({ id: "a1", status: "pending", ownerUid: "uid-cust" });
    const res = await request(buildApp())
      .post("/artists/a1/approve")
      .set("x-test-user", ADMIN)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("published");
    expect(res.body.approvedBy).toBe("uid-admin");
    expect(typeof res.body.approvedAt).toBe("string");
    // updatedAt is bumped
    expect(typeof res.body.updatedAt).toBe("string");
  });

  it("T-ARTIST-031b — customer cannot approve → 403", async () => {
    seedArtist({ id: "a1", status: "pending" });
    const res = await request(buildApp())
      .post("/artists/a1/approve")
      .set("x-test-user", CUSTOMER)
      .send({});
    expect(res.status).toBe(403);
  });

  it("T-ARTIST-032 — approve missing artist → 404", async () => {
    const res = await request(buildApp())
      .post("/artists/missing/approve")
      .set("x-test-user", ADMIN)
      .send({});
    expect(res.status).toBe(404);
  });

  it("T-ARTIST-033 — approve an already-published artist → 409", async () => {
    seedArtist({
      id: "a1",
      status: "published",
      approvedAt: "2026-05-01T00:00:00.000Z",
      approvedBy: "uid-admin",
    });
    const res = await request(buildApp())
      .post("/artists/a1/approve")
      .set("x-test-user", ADMIN)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(res.body.message).toMatch(/already published/i);
  });

  // ─── CTR-107 — reject ────────────────────────────────────────────────

  it("T-ARTIST-034 — admin rejects with reason → status=rejected, rejectionReason stored", async () => {
    seedArtist({ id: "a1", status: "pending" });
    const res = await request(buildApp())
      .post("/artists/a1/reject")
      .set("x-test-user", ADMIN)
      .send({ reason: "Name conflicts with existing trademark" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("rejected");
    expect(res.body.rejectionReason).toBe("Name conflicts with existing trademark");
  });

  it("T-ARTIST-034b — default reason applied when body omits reason", async () => {
    seedArtist({ id: "a1", status: "pending" });
    const res = await request(buildApp())
      .post("/artists/a1/reject")
      .set("x-test-user", ADMIN)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.rejectionReason).toBe("Rejected by admin");
  });

  it("T-ARTIST-034c — default reason when reason is non-string (number)", async () => {
    seedArtist({ id: "a1", status: "pending" });
    const res = await request(buildApp())
      .post("/artists/a1/reject")
      .set("x-test-user", ADMIN)
      .send({ reason: 12345 });
    expect(res.status).toBe(200);
    expect(res.body.rejectionReason).toBe("Rejected by admin");
  });

  it("T-ARTIST-034d — customer cannot reject → 403", async () => {
    seedArtist({ id: "a1", status: "pending" });
    const res = await request(buildApp())
      .post("/artists/a1/reject")
      .set("x-test-user", CUSTOMER)
      .send({ reason: "x" });
    expect(res.status).toBe(403);
  });

  it("T-ARTIST-034e — reject missing artist → 404", async () => {
    const res = await request(buildApp())
      .post("/artists/missing/reject")
      .set("x-test-user", ADMIN)
      .send({});
    expect(res.status).toBe(404);
  });

  it("T-ARTIST-034f — reject handles missing body gracefully (no JSON body)", async () => {
    seedArtist({ id: "a1", status: "pending" });
    const res = await request(buildApp()).post("/artists/a1/reject").set("x-test-user", ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.rejectionReason).toBe("Rejected by admin");
  });

  // ─── DECISION-2026-05-05-017 — re-approval and re-rejection edges ──

  it("T-ARTIST-035 — admin re-approves a rejected artist → status=published; rejectionReason kept (audit)", async () => {
    seedArtist({
      id: "a1",
      status: "rejected",
      rejectionReason: "Initial reason",
    });
    const res = await request(buildApp())
      .post("/artists/a1/approve")
      .set("x-test-user", ADMIN)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("published");
    expect(res.body.approvedBy).toBe("uid-admin");
    // Per DECISION-2026-05-05-017: rejectionReason is intentionally NOT cleared on
    // re-approval — it remains as a historical audit record.
    expect(res.body.rejectionReason).toBe("Initial reason");
  });

  it("T-ARTIST-036 — admin re-rejects a published artist → status=rejected; approvedAt+By preserved", async () => {
    seedArtist({
      id: "a1",
      status: "published",
      approvedAt: "2026-05-01T00:00:00.000Z",
      approvedBy: "uid-admin-old",
    });
    const res = await request(buildApp())
      .post("/artists/a1/reject")
      .set("x-test-user", ADMIN)
      .send({ reason: "Pulled down — guideline breach" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("rejected");
    expect(res.body.rejectionReason).toBe("Pulled down — guideline breach");
    // approvedAt + approvedBy intentionally preserved (audit trail).
    expect(res.body.approvedAt).toBe("2026-05-01T00:00:00.000Z");
    expect(res.body.approvedBy).toBe("uid-admin-old");
  });
});
