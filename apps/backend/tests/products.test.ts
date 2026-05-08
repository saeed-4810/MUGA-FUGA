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
const mintId = () => `prod_${++docCounter}`;

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

  const makeQuery = (filter: { ownerUid?: string; status?: string } = {}) => ({
    orderBy: () => makeQuery(filter),
    limit: () => makeQuery(filter),
    where: (field: string, _op: string, value: string) => makeQuery({ ...filter, [field]: value }),
    get: async () => {
      if (dbBehaviour.getMode === "throw") throw new Error("firestore unavailable");
      const docs = Array.from(store.entries())
        .filter(([, rec]) => !filter.status || rec.data.status === filter.status)
        .filter(([, rec]) => !filter.ownerUid || rec.data.ownerUid === filter.ownerUid)
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
      if (header === "__no-uid__") {
        req.user = {
          uid: undefined as unknown as string,
          email: "ghost@muga.app",
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
        email: email ?? `${uid}@muga.app`,
        emailVerified: true,
      };
      next();
    },
  };
});

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

const SAEED = "usr_saeed_h:customer:saeedh582@gmail.com";
const JAMIE = "usr_jamie_lee:customer:jamie.lee@gmail.com";
const MARCUS = "usr_marcus_admin:admin:marcus@muga.app";

const seedProduct = (overrides: Partial<Product> = {}): Product => {
  const id = overrides.id ?? mintId();
  const now = new Date().toISOString();
  const product: Product = {
    id,
    name: "Midnights",
    artistId: "art_taylor_swift",
    coverArtPath: `cover-art/${id}/midnights.jpg`,
    status: "pending",
    ownerUid: "usr_saeed_h",
    ownerEmail: "saeedh582@gmail.com",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  store.set(id, { data: product });
  return product;
};

const seedArtist = (overrides: Partial<Artist> = {}): Artist => {
  const now = new Date().toISOString();
  const id = overrides.id ?? "art_taylor_swift";
  const name = overrides.name ?? "Taylor Swift";
  const artist: Artist = {
    id,
    name,
    name_lc: name.trim().toLowerCase(),
    slug: name.trim().toLowerCase().replace(/\s+/g, "-"),
    status: "published",
    ownerUid: "usr_saeed_h",
    ownerEmail: "saeedh582@gmail.com",
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
  stubEnv.FIREBASE_STORAGE_EMULATOR_HOST = "";
});

describe("POST /products/signed-upload — cover-art upload URL (CTR-002)", () => {
  it("T-UP-001 — no auth → 401", async () => {
    const res = await request(buildApp())
      .post("/products/signed-upload")
      .send({ contentType: "image/jpeg", fileSize: 1024 });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHENTICATED");
  });

  it("T-UP-002 — uploading a PDF instead of an image is a 400", async () => {
    const res = await request(buildApp())
      .post("/products/signed-upload")
      .set("x-test-user", SAEED)
      .send({ contentType: "application/pdf", fileSize: 1024 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.details.issues[0].message).toMatch(/JPEG|PNG|WEBP|AVIF/i);
  });

  it("T-UP-002b — anything bigger than 5 MB is also a 400", async () => {
    const res = await request(buildApp())
      .post("/products/signed-upload")
      .set("x-test-user", SAEED)
      .send({ contentType: "image/jpeg", fileSize: 5 * 1024 * 1024 + 1 });
    expect(res.status).toBe(400);
    expect(res.body.details.issues[0].message).toMatch(/5 MB/);
  });

  it("T-UP-002c — validation failure also fires an upload_validation_fail alert (A5)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await request(buildApp())
      .post("/products/signed-upload")
      .set("x-test-user", SAEED)
      .send({ contentType: "application/pdf", fileSize: 1024 });
    const fired = info.mock.calls.find((c) => {
      const obj = c[0] as Record<string, unknown> | undefined;
      return obj && (obj as { alert?: { kind?: string } }).alert?.kind === "upload_validation_fail";
    });
    expect(fired).toBeTruthy();
    info.mockRestore();
  });

  it("T-UP-003 — Saeed asking for a JPEG upload gets a signed URL with the right object path + expiry", async () => {
    const res = await request(buildApp())
      .post("/products/signed-upload")
      .set("x-test-user", SAEED)
      .send({ contentType: "image/jpeg", fileSize: 1024 });
    expect(res.status).toBe(201);
    expect(res.body.uploadUrl).toMatch(/^https:\/\/storage\.example\.com\//);
    expect(res.body.objectPath).toMatch(/^cover-art\/usr_saeed_h\/\d+-/);
    expect(typeof res.body.expiresAt).toBe("string");
    expect(new Date(res.body.expiresAt).toString()).not.toBe("Invalid Date");
    expect(signedUrlCalls).toHaveLength(1);
    expect(signedUrlCalls[0]!.contentType).toBe("image/jpeg");
  });

  it("T-UP-003b — if Storage blows up we surface 500 INTERNAL", async () => {
    storageBehaviour.signedUrlMode = "throw";
    const res = await request(buildApp())
      .post("/products/signed-upload")
      .set("x-test-user", SAEED)
      .send({ contentType: "image/jpeg", fileSize: 1024 });
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("INTERNAL");
  });

  it("T-UP-003c — alert payload still works when requestId/uid are missing", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const app = express();
    app.use(express.json());
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
    expect(payload["requestId"]).toBe("unknown");
    expect(payload["userUid"]).toBeNull();
    info.mockRestore();
  });

  it("T-UP-003d — when something weird (not an Error) is thrown, we still emit a sensible alert message", async () => {
    storageBehaviour.signedUrlMode = "throw-non-error";
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const res = await request(buildApp())
      .post("/products/signed-upload")
      .set("x-test-user", SAEED)
      .send({ contentType: "image/jpeg", fileSize: 1024 });
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

describe("POST /products — creating a product (CTR-003)", () => {
  it("T-PROD-001 — Saeed creates 'Midnights' attached to Taylor Swift → status=pending, artist dereferenced inline", async () => {
    const res = await request(buildApp()).post("/products").set("x-test-user", SAEED).send({
      name: "Midnights",
      artistId: "art_taylor_swift",
      coverArtPath: "cover-art/usr_saeed_h/midnights-cover.jpg",
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    expect(res.body.ownerUid).toBe("usr_saeed_h");
    expect(res.body.ownerEmail).toBe("saeedh582@gmail.com");
    expect(res.body.artist).toMatchObject({
      id: "art_taylor_swift",
      name: "Taylor Swift",
      status: "published",
    });
    expect(res.body.approvedAt).toBeUndefined();
    expect(() => ProductSchema.parse(res.body)).not.toThrow();
    expect(store.size).toBe(1);
  });

  it("T-PROD-002 — admin (Marcus) creating a product publishes it instantly with audit fields", async () => {
    const res = await request(buildApp()).post("/products").set("x-test-user", MARCUS).send({
      name: "1989 (Taylor's Version)",
      artistId: "art_taylor_swift",
      coverArtPath: "cover-art/usr_marcus_admin/1989-tv.jpg",
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("published");
    expect(res.body.approvedBy).toBe("usr_marcus_admin");
    expect(typeof res.body.approvedAt).toBe("string");
  });

  it("T-PROD-003 — missing name → 400", async () => {
    const res = await request(buildApp())
      .post("/products")
      .set("x-test-user", SAEED)
      .send({ artistId: "art_taylor_swift", coverArtPath: "p" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("T-PROD-003b — no auth → 401", async () => {
    const res = await request(buildApp())
      .post("/products")
      .send({ name: "Midnights", artistId: "art_taylor_swift", coverArtPath: "p" });
    expect(res.status).toBe(401);
  });

  it("T-PROD-012 — pointing at an artistId that doesn't exist → 422 ARTIST_NOT_FOUND", async () => {
    const res = await request(buildApp()).post("/products").set("x-test-user", SAEED).send({
      name: "Lost Album",
      artistId: "art_does_not_exist",
      coverArtPath: "cover-art/usr_saeed_h/missing",
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("ARTIST_NOT_FOUND");
    expect(res.body.details.artistId).toBe("art_does_not_exist");
  });

  it("T-PROD-013 — Saeed can't attach a product to Jamie's pending artist → 422 ARTIST_NOT_PUBLISHED", async () => {
    seedArtist({
      id: "art_jamies_pending",
      status: "pending",
      name: "Jamie's Indie Project",
      ownerUid: "usr_jamie_lee",
    });
    const res = await request(buildApp()).post("/products").set("x-test-user", SAEED).send({
      name: "Borrowed Identity",
      artistId: "art_jamies_pending",
      coverArtPath: "cover-art/usr_saeed_h/borrowed",
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("ARTIST_NOT_PUBLISHED");
    expect(res.body.details.artistId).toBe("art_jamies_pending");
  });

  it("T-PROD-013c — Saeed CAN attach a product to his own pending artist (his own request)", async () => {
    seedArtist({ id: "art_saeeds_pending", status: "pending", name: "Saeed's New Project" });
    const res = await request(buildApp()).post("/products").set("x-test-user", SAEED).send({
      name: "Demo Tape",
      artistId: "art_saeeds_pending",
      coverArtPath: "cover-art/usr_saeed_h/demo",
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    expect(res.body.artist).toMatchObject({ id: "art_saeeds_pending", status: "pending" });
  });

  it("T-PROD-014 — admin override: Marcus attaches a product to a pending artist; admin_override alert fires", async () => {
    seedArtist({ id: "art_unverified_x", status: "pending", name: "Unverified X" });
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const res = await request(buildApp()).post("/products").set("x-test-user", MARCUS).send({
      name: "Override Drop",
      artistId: "art_unverified_x",
      coverArtPath: "cover-art/usr_marcus_admin/override",
    });
    expect(res.status).toBe(201);
    expect(res.body.artist).toMatchObject({ id: "art_unverified_x", status: "pending" });
    const fired = info.mock.calls.find((c) => {
      const obj = c[0] as Record<string, unknown> | undefined;
      return obj && (obj as { alert?: { kind?: string } }).alert?.kind === "admin_override";
    });
    expect(fired).toBeTruthy();
    const payload = fired![0] as Record<string, unknown>;
    expect(payload["artistId"]).toBe("art_unverified_x");
    expect(payload["adminUid"]).toBe("usr_marcus_admin");
    info.mockRestore();
  });
});

describe("GET /products — listing products (CTR-004)", () => {
  it("T-PROD-004 — customers see published products plus their own pending products", async () => {
    seedProduct({
      id: "prod_midnights",
      status: "published",
      ownerUid: "usr_jamie_lee",
      createdAt: "2026-05-01T10:00:00.000Z",
    });
    seedProduct({
      id: "prod_saeed_pending",
      status: "pending",
      ownerUid: "usr_saeed_h",
      createdAt: "2026-05-02T10:00:00.000Z",
    });
    seedProduct({ id: "prod_jamie_pending", status: "pending", ownerUid: "usr_jamie_lee" });
    seedProduct({ id: "prod_saeed_rejected", status: "rejected", ownerUid: "usr_saeed_h" });
    const res = await request(buildApp()).get("/products").set("x-test-user", SAEED);
    expect(res.status).toBe(200);
    expect(res.body.items.map((item: Product) => item.id)).toEqual([
      "prod_saeed_pending",
      "prod_midnights",
    ]);
  });

  it("T-PROD-005 — admin sees all products at any status by default", async () => {
    seedProduct({ id: "prod_midnights", status: "published" });
    seedProduct({ id: "prod_pending_a", status: "pending" });
    seedProduct({ id: "prod_rejected_b", status: "rejected" });
    const res = await request(buildApp()).get("/products").set("x-test-user", MARCUS);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);
  });

  it("T-PROD-015 — listing dereferences the *current* artist (renames show up live)", async () => {
    seedArtist({
      id: "art_daft_punk",
      name: "Daft Punk",
      imageUrl: "https://cdn.example.com/daft-punk.jpg",
    });
    seedProduct({
      id: "prod_random_access_memories",
      name: "Random Access Memories",
      status: "published",
      artistId: "art_daft_punk",
    });
    const res = await request(buildApp()).get("/products").set("x-test-user", SAEED);
    expect(res.status).toBe(200);
    expect(res.body.items[0].artist).toEqual({
      id: "art_daft_punk",
      name: "Daft Punk",
      imageUrl: "https://cdn.example.com/daft-punk.jpg",
      status: "published",
    });
  });

  it("T-PROD-015b — listing omits generated image URLs when Storage read signing fails", async () => {
    seedArtist({
      id: "art_daft_punk",
      name: "Daft Punk",
      imageObjectPath: "artist-images/daft.jpg",
    });
    seedProduct({
      id: "prod_random_access_memories",
      name: "Random Access Memories",
      status: "published",
      artistId: "art_daft_punk",
      coverArtPath: "cover-art/prod_random_access_memories/cover.jpg",
    });
    storageBehaviour.signedUrlMode = "throw";
    const res = await request(buildApp()).get("/products").set("x-test-user", SAEED);
    expect(res.status).toBe(200);
    expect(res.body.items[0]).not.toHaveProperty("coverArtUrl");
    expect(res.body.items[0].artist).toEqual({
      id: "art_daft_punk",
      name: "Daft Punk",
      status: "published",
    });
  });

  it("T-PROD-015c — local Storage emulator returns browser-readable cover and artist media URLs", async () => {
    stubEnv.FIREBASE_STORAGE_EMULATOR_HOST = "http://127.0.0.1:9199";
    seedArtist({
      id: "art_daft_punk",
      name: "Daft Punk",
      imageObjectPath: "artist-images/daft/head.jpg",
    });
    seedProduct({
      id: "prod_random_access_memories",
      name: "Random Access Memories",
      status: "published",
      artistId: "art_daft_punk",
      coverArtPath: "cover-art/prod_random_access_memories/cover.jpg",
    });
    const res = await request(buildApp()).get("/products").set("x-test-user", SAEED);
    expect(res.status).toBe(200);
    expect(res.body.items[0].coverArtUrl).toBe(
      "http://127.0.0.1:9199/v0/b/muga-test.appspot.com/o/cover-art%2Fprod_random_access_memories%2Fcover.jpg?alt=media"
    );
    expect(res.body.items[0].artist.imageUrl).toBe(
      "http://127.0.0.1:9199/v0/b/muga-test.appspot.com/o/artist-images%2Fdaft%2Fhead.jpg?alt=media"
    );
  });

  it("T-PROD-015d — local Storage emulator prefixes hosts without an explicit scheme", async () => {
    stubEnv.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
    seedProduct({
      id: "prod_local",
      status: "published",
      coverArtPath: "cover-art/prod_local/cover.jpg",
    });
    const res = await request(buildApp()).get("/products").set("x-test-user", SAEED);
    expect(res.status).toBe(200);
    expect(res.body.items[0].coverArtUrl).toBe(
      "http://127.0.0.1:9199/v0/b/muga-test.appspot.com/o/cover-art%2Fprod_local%2Fcover.jpg?alt=media"
    );
  });

  it("T-PROD-005b — admin can filter the list by ?status=pending", async () => {
    seedProduct({ id: "prod_midnights", status: "published" });
    seedProduct({ id: "prod_pending_a", status: "pending" });
    const res = await request(buildApp())
      .get("/products?status=pending")
      .set("x-test-user", MARCUS);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]!.status).toBe("pending");
  });

  it("T-PROD-006 — no published or own pending products → empty list (NOT a 404)", async () => {
    seedProduct({ id: "prod_pending_a", status: "pending", ownerUid: "usr_jamie_lee" });
    const res = await request(buildApp()).get("/products").set("x-test-user", SAEED);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it("T-PROD-006b — listing with no auth → 401", async () => {
    const res = await request(buildApp()).get("/products");
    expect(res.status).toBe(401);
  });

  it("T-PROD-006c — Firestore failing during list → 500", async () => {
    dbBehaviour.getMode = "throw";
    const res = await request(buildApp()).get("/products").set("x-test-user", MARCUS);
    expect(res.status).toBe(500);
  });
});

describe("GET /products/:id — reading a single product (CTR-005)", () => {
  it("T-PROD-007 — anyone authenticated can read a published product, with the artist dereferenced", async () => {
    seedProduct({ id: "prod_midnights", status: "published", ownerUid: "usr_jamie_lee" });
    const res = await request(buildApp()).get("/products/prod_midnights").set("x-test-user", SAEED);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("prod_midnights");
    expect(res.body.artist).toMatchObject({ id: "art_taylor_swift", name: "Taylor Swift" });
  });

  it("T-PROD-007b — Saeed can read his own pending product while it waits for review", async () => {
    seedProduct({ id: "prod_my_demo", status: "pending", ownerUid: "usr_saeed_h" });
    const res = await request(buildApp()).get("/products/prod_my_demo").set("x-test-user", SAEED);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("prod_my_demo");
  });

  it("T-PROD-007c — pending products owned by someone else 404 to other customers", async () => {
    seedProduct({ id: "prod_jamies_secret", status: "pending", ownerUid: "usr_jamie_lee" });
    const res = await request(buildApp())
      .get("/products/prod_jamies_secret")
      .set("x-test-user", SAEED);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("T-PROD-007d — admin can read anyone's product at any status", async () => {
    seedProduct({ id: "prod_jamies_secret", status: "pending", ownerUid: "usr_jamie_lee" });
    const res = await request(buildApp())
      .get("/products/prod_jamies_secret")
      .set("x-test-user", MARCUS);
    expect(res.status).toBe(200);
  });

  it("T-PROD-007e — unknown id → 404", async () => {
    const res = await request(buildApp())
      .get("/products/prod_does_not_exist")
      .set("x-test-user", SAEED);
    expect(res.status).toBe(404);
  });

  it("T-PROD-007f — Firestore failure during read → 500", async () => {
    seedProduct({ id: "prod_midnights", status: "published" });
    dbBehaviour.getMode = "throw";
    const res = await request(buildApp()).get("/products/prod_midnights").set("x-test-user", SAEED);
    expect(res.status).toBe(500);
  });
});

describe("PATCH /products/:id — updating a product (CTR-006)", () => {
  it("T-PROD-008 — owner renames their product → 200, store reflects the new name", async () => {
    seedProduct({ id: "prod_midnights", name: "Midnights", ownerUid: "usr_saeed_h" });
    const res = await request(buildApp())
      .patch("/products/prod_midnights")
      .set("x-test-user", SAEED)
      .send({ name: "Midnights (3am Edition)" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Midnights (3am Edition)");
    expect(store.get("prod_midnights")!.data.name).toBe("Midnights (3am Edition)");
  });

  it("T-PROD-008b — admin can edit anyone's product", async () => {
    seedProduct({ id: "prod_midnights", name: "Midnights", ownerUid: "usr_jamie_lee" });
    const res = await request(buildApp())
      .patch("/products/prod_midnights")
      .set("x-test-user", MARCUS)
      .send({ name: "Midnights (Admin Edit)" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Midnights (Admin Edit)");
  });

  it("T-PROD-008c — patching just the artistId leaves the name alone (partial updates don't clobber)", async () => {
    seedProduct({
      id: "prod_midnights",
      name: "Midnights",
      artistId: "art_taylor_swift",
      ownerUid: "usr_saeed_h",
    });
    seedArtist({ id: "art_taylor_alison_swift", name: "Taylor Alison Swift" });
    const res = await request(buildApp())
      .patch("/products/prod_midnights")
      .set("x-test-user", SAEED)
      .send({ artistId: "art_taylor_alison_swift" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Midnights");
    expect(res.body.artistId).toBe("art_taylor_alison_swift");
    expect(res.body.artist.name).toBe("Taylor Alison Swift");
  });

  it("T-PROD-014b — admin can re-point a product at a pending artist; admin_override fires", async () => {
    seedProduct({
      id: "prod_midnights",
      artistId: "art_taylor_swift",
      ownerUid: "usr_jamie_lee",
    });
    seedArtist({ id: "art_unverified_x", status: "pending", name: "Unverified X" });
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const res = await request(buildApp())
      .patch("/products/prod_midnights")
      .set("x-test-user", MARCUS)
      .send({ artistId: "art_unverified_x" });
    expect(res.status).toBe(200);
    expect(res.body.artist).toMatchObject({ id: "art_unverified_x", status: "pending" });
    const fired = info.mock.calls.find((c) => {
      const obj = c[0] as Record<string, unknown> | undefined;
      return obj && (obj as { alert?: { kind?: string } }).alert?.kind === "admin_override";
    });
    expect(fired).toBeTruthy();
    const payload = fired![0] as Record<string, unknown>;
    expect(payload["productId"]).toBe("prod_midnights");
    expect(payload["artistStatus"]).toBe("pending");
    info.mockRestore();
  });

  it("T-PROD-009 — Jamie can't edit Saeed's product → 403", async () => {
    seedProduct({ id: "prod_midnights", ownerUid: "usr_saeed_h" });
    const res = await request(buildApp())
      .patch("/products/prod_midnights")
      .set("x-test-user", JAMIE)
      .send({ name: "Hijack" });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("T-PROD-009b — patching a product that doesn't exist → 404", async () => {
    const res = await request(buildApp())
      .patch("/products/prod_ghost")
      .set("x-test-user", SAEED)
      .send({ name: "X" });
    expect(res.status).toBe(404);
  });

  it("T-PROD-009c — names longer than 120 chars → 400", async () => {
    seedProduct({ id: "prod_midnights", ownerUid: "usr_saeed_h" });
    const res = await request(buildApp())
      .patch("/products/prod_midnights")
      .set("x-test-user", SAEED)
      .send({ name: "x".repeat(121) });
    expect(res.status).toBe(400);
  });

  it("T-PROD-012b — patching artistId to an unknown artist → 422 ARTIST_NOT_FOUND", async () => {
    seedProduct({ id: "prod_midnights", ownerUid: "usr_saeed_h" });
    const res = await request(buildApp())
      .patch("/products/prod_midnights")
      .set("x-test-user", SAEED)
      .send({ artistId: "art_does_not_exist" });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("ARTIST_NOT_FOUND");
  });

  it("T-PROD-013b — Saeed can't repoint his product to Jamie's pending artist → 422", async () => {
    seedProduct({ id: "prod_midnights", ownerUid: "usr_saeed_h" });
    seedArtist({
      id: "art_jamies_pending",
      status: "pending",
      name: "Jamie's Pending",
      ownerUid: "usr_jamie_lee",
    });
    const res = await request(buildApp())
      .patch("/products/prod_midnights")
      .set("x-test-user", SAEED)
      .send({ artistId: "art_jamies_pending" });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("ARTIST_NOT_PUBLISHED");
  });

  it("T-PROD-013d — Saeed CAN repoint his product to his own pending artist", async () => {
    seedProduct({ id: "prod_midnights", ownerUid: "usr_saeed_h" });
    seedArtist({ id: "art_saeeds_pending", status: "pending", name: "Saeed's Pending" });
    const res = await request(buildApp())
      .patch("/products/prod_midnights")
      .set("x-test-user", SAEED)
      .send({ artistId: "art_saeeds_pending" });
    expect(res.status).toBe(200);
    expect(res.body.artist).toMatchObject({ id: "art_saeeds_pending", status: "pending" });
  });
});

describe("DELETE /products/:id — deleting a product (CTR-007)", () => {
  it("T-PROD-010 — owner deletes their product → 204 + Storage object cleaned up", async () => {
    seedProduct({
      id: "prod_midnights",
      coverArtPath: "cover-art/usr_saeed_h/midnights-cover.jpg",
      ownerUid: "usr_saeed_h",
    });
    const res = await request(buildApp())
      .delete("/products/prod_midnights")
      .set("x-test-user", SAEED);
    expect(res.status).toBe(204);
    expect(store.has("prod_midnights")).toBe(false);
    expect(objectDeleteCalls).toContain("cover-art/usr_saeed_h/midnights-cover.jpg");
  });

  it("T-PROD-010b — admin can delete any product", async () => {
    seedProduct({ id: "prod_midnights", ownerUid: "usr_jamie_lee" });
    const res = await request(buildApp())
      .delete("/products/prod_midnights")
      .set("x-test-user", MARCUS);
    expect(res.status).toBe(204);
  });

  it("T-PROD-010c — Storage delete failure does NOT block the delete (best-effort cleanup)", async () => {
    seedProduct({ id: "prod_midnights", ownerUid: "usr_saeed_h" });
    storageBehaviour.objectDeleteMode = "throw";
    const res = await request(buildApp())
      .delete("/products/prod_midnights")
      .set("x-test-user", SAEED);
    expect(res.status).toBe(204);
    expect(store.has("prod_midnights")).toBe(false);
  });

  it("T-PROD-011 — Jamie can't delete Saeed's product → 403, doc untouched", async () => {
    seedProduct({ id: "prod_midnights", ownerUid: "usr_saeed_h" });
    const res = await request(buildApp())
      .delete("/products/prod_midnights")
      .set("x-test-user", JAMIE);
    expect(res.status).toBe(403);
    expect(store.has("prod_midnights")).toBe(true);
  });

  it("T-PROD-011b — deleting a product that doesn't exist → 404", async () => {
    const res = await request(buildApp()).delete("/products/prod_ghost").set("x-test-user", SAEED);
    expect(res.status).toBe(404);
  });
});

describe("POST /products/:id/approve — admin approval (CTR-008)", () => {
  it("T-ADMIN-001 — Marcus approves Saeed's pending Midnights → status flips to published, audit fields set", async () => {
    seedProduct({ id: "prod_midnights", status: "pending" });
    const res = await request(buildApp())
      .post("/products/prod_midnights/approve")
      .set("x-test-user", MARCUS)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("published");
    expect(res.body.approvedBy).toBe("usr_marcus_admin");
    expect(typeof res.body.approvedAt).toBe("string");
  });

  it("T-ADMIN-001b — Saeed (customer) can't approve products → 403", async () => {
    seedProduct({ id: "prod_midnights", status: "pending" });
    const res = await request(buildApp())
      .post("/products/prod_midnights/approve")
      .set("x-test-user", SAEED)
      .send({});
    expect(res.status).toBe(403);
  });

  it("T-ADMIN-001c — approving with no auth → 401", async () => {
    const res = await request(buildApp()).post("/products/prod_midnights/approve").send({});
    expect(res.status).toBe(401);
  });

  it("T-ADMIN-002 — approving an already-published product → 409 (no double approve)", async () => {
    seedProduct({ id: "prod_midnights", status: "published" });
    const res = await request(buildApp())
      .post("/products/prod_midnights/approve")
      .set("x-test-user", MARCUS)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
  });

  it("T-ADMIN-002b — approving a product that doesn't exist → 404", async () => {
    const res = await request(buildApp())
      .post("/products/prod_ghost/approve")
      .set("x-test-user", MARCUS)
      .send({});
    expect(res.status).toBe(404);
  });

  it("T-ADMIN-002c — approval fires an admin_action alert for the audit trail", async () => {
    seedProduct({ id: "prod_midnights", status: "pending" });
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await request(buildApp())
      .post("/products/prod_midnights/approve")
      .set("x-test-user", MARCUS)
      .send({});
    const fired = info.mock.calls.find((c) => {
      const obj = c[0] as Record<string, unknown> | undefined;
      return obj && (obj as { alert?: { kind?: string } }).alert?.kind === "admin_action";
    });
    expect(fired).toBeTruthy();
    info.mockRestore();
  });
});

describe("POST /products/:id/reject — admin rejection (CTR-009)", () => {
  it("T-ADMIN-003 — admin rejects with a reason, that reason gets stored on the doc", async () => {
    seedProduct({ id: "prod_midnights", status: "pending" });
    const res = await request(buildApp())
      .post("/products/prod_midnights/reject")
      .set("x-test-user", MARCUS)
      .send({ reason: "Cover art breaches our guidelines" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("rejected");
    expect(res.body.rejectionReason).toBe("Cover art breaches our guidelines");
  });

  it("T-ADMIN-003b — rejecting with no reason in the body → falls back to 'Rejected by admin'", async () => {
    seedProduct({ id: "prod_midnights", status: "pending" });
    const res = await request(buildApp())
      .post("/products/prod_midnights/reject")
      .set("x-test-user", MARCUS)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.rejectionReason).toBe("Rejected by admin");
  });

  it("T-ADMIN-003c — non-string reason (e.g. number) also falls back to default", async () => {
    seedProduct({ id: "prod_midnights", status: "pending" });
    const res = await request(buildApp())
      .post("/products/prod_midnights/reject")
      .set("x-test-user", MARCUS)
      .send({ reason: 12345 });
    expect(res.status).toBe(200);
    expect(res.body.rejectionReason).toBe("Rejected by admin");
  });

  it("T-ADMIN-003d — Saeed can't reject products → 403", async () => {
    seedProduct({ id: "prod_midnights", status: "pending" });
    const res = await request(buildApp())
      .post("/products/prod_midnights/reject")
      .set("x-test-user", SAEED)
      .send({});
    expect(res.status).toBe(403);
  });

  it("T-ADMIN-003e — rejecting a non-existent product → 404", async () => {
    const res = await request(buildApp())
      .post("/products/prod_ghost/reject")
      .set("x-test-user", MARCUS)
      .send({});
    expect(res.status).toBe(404);
  });

  it("T-ADMIN-003f — reject with no body at all (not even {}) → still works, default reason", async () => {
    seedProduct({ id: "prod_midnights", status: "pending" });
    const res = await request(buildApp())
      .post("/products/prod_midnights/reject")
      .set("x-test-user", MARCUS);
    expect(res.status).toBe(200);
    expect(res.body.rejectionReason).toBe("Rejected by admin");
  });
});
