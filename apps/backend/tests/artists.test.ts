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
 * Tests for the Artists CRUD endpoints (CTR-100..107).
 *
 * Scenario coverage:
 *   T-ARTIST-UP-001..003   Signed-upload reuse (CTR-100)
 *   T-ARTIST-001..006      Create (CTR-101) — admin/customer status, uniqueness, slug derive
 *   T-ARTIST-007..014      List (CTR-102) — RBAC scope, status filter (single + comma list), ownerUid
 *   T-ARTIST-015..018      Read one (CTR-103) — RBAC + 404-hide
 *   T-ARTIST-019..023      Update (CTR-104) — owner/admin, rename triggers slug regen + uniqueness
 *   T-ARTIST-024..030      Delete (CTR-105) — RBAC + FK delete-block 409 + image cleanup
 *   T-ARTIST-031..036      Approve / Reject (CTR-106, CTR-107)
 */

type ArtistRec = { data: Artist };
const store: Map<string, ArtistRec> = new Map();
type ProductRec = { id: string; artistId: string };
const productStore: Map<string, ProductRec> = new Map();

const storageBehaviour: {
  signedUrlMode: "ok" | "throw" | "throw-non-error";
  objectDeleteMode: "ok" | "throw";
} = {
  signedUrlMode: "ok",
  objectDeleteMode: "ok",
};

const dbBehaviour: { listMode: "ok" | "throw" } = { listMode: "ok" };

const objectDeleteCalls: string[] = [];
let docCounter = 0;
const mintId = () => `art_${++docCounter}`;

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
    return {
      doc: (id?: string) => makeArtistDocRef(id ?? mintId()),
      orderBy: makeArtistQuery().orderBy,
      limit: makeArtistQuery().limit,
      where: makeArtistQuery().where,
    };
  };

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

const SAEED = "usr_saeed_h:customer:saeedh582@gmail.com";
const JAMIE = "usr_jamie_lee:customer:jamie.lee@gmail.com";
const MARCUS = "usr_marcus_admin:admin:marcus@muga.app";

const seedArtist = (overrides: Partial<Artist> = {}): Artist => {
  const id = overrides.id ?? mintId();
  const now = new Date().toISOString();
  const name = overrides.name ?? "Taylor Swift";
  const a: Artist = {
    id,
    name,
    name_lc: overrides.name_lc ?? name.trim().toLowerCase(),
    slug: overrides.slug ?? name.trim().toLowerCase().replace(/\s+/g, "-"),
    status: "pending",
    ownerUid: "usr_saeed_h",
    ownerEmail: "saeedh582@gmail.com",
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
  stubEnv.FIREBASE_STORAGE_EMULATOR_HOST = "";
});

describe("POST /artists/signed-upload — cover-image upload URL (CTR-100)", () => {
  it("T-ARTIST-UP-001 — returns 401 when no one is logged in", async () => {
    const res = await request(buildApp())
      .post("/artists/signed-upload")
      .send({ contentType: "image/jpeg", fileSize: 1024 });
    expect(res.status).toBe(401);
  });

  it("T-ARTIST-UP-002 — gives the user a signed URL pointing into artist-images/<uid>/", async () => {
    const res = await request(buildApp())
      .post("/artists/signed-upload")
      .set("x-test-user", SAEED)
      .send({ contentType: "image/png", fileSize: 1024 });
    expect(res.status).toBe(201);
    expect(res.body.objectPath).toMatch(/^artist-images\/usr_saeed_h\/\d+-/);
    expect(res.body.uploadUrl).toContain("ct=image/png");
  });

  it("T-ARTIST-UP-003 — rejects non-image uploads (e.g. PDF) with 400", async () => {
    const res = await request(buildApp())
      .post("/artists/signed-upload")
      .set("x-test-user", SAEED)
      .send({ contentType: "application/pdf", fileSize: 1024 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("T-ARTIST-UP-003b — bubbles up Storage failures as 500", async () => {
    storageBehaviour.signedUrlMode = "throw";
    const res = await request(buildApp())
      .post("/artists/signed-upload")
      .set("x-test-user", SAEED)
      .send({ contentType: "image/jpeg", fileSize: 1024 });
    expect(res.status).toBe(500);
  });

  it("T-ARTIST-UP-003c — also handles weird non-Error throws from the Storage SDK", async () => {
    storageBehaviour.signedUrlMode = "throw-non-error";
    const res = await request(buildApp())
      .post("/artists/signed-upload")
      .set("x-test-user", SAEED)
      .send({ contentType: "image/jpeg", fileSize: 1024 });
    expect(res.status).toBe(500);
  });

  it("T-ARTIST-UP-003d — alert payload still emits when requestId/uid are missing", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const app = express();
    app.use(express.json());
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

describe("POST /artists — creating an artist (CTR-101)", () => {
  it("T-ARTIST-001 — when Saeed creates 'Taylor Swift' it lands in pending with derived name_lc + slug", async () => {
    const res = await request(buildApp())
      .post("/artists")
      .set("x-test-user", SAEED)
      .send({ name: "Taylor Swift" });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("pending");
    expect(res.body.name).toBe("Taylor Swift");
    expect(res.body.name_lc).toBe("taylor swift");
    expect(res.body.slug).toBe("taylor-swift");
    expect(res.body.ownerUid).toBe("usr_saeed_h");
    expect(res.body.approvedAt).toBeUndefined();
    expect(() => ArtistSchema.parse(res.body)).not.toThrow();
  });

  it("T-ARTIST-002 — when an admin (Marcus) creates an artist it goes straight to published", async () => {
    const res = await request(buildApp()).post("/artists").set("x-test-user", MARCUS).send({
      name: "Daft Punk",
      bio: "French electronic duo from Paris.",
      country: "FR",
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("published");
    expect(res.body.approvedBy).toBe("usr_marcus_admin");
    expect(res.body.bio).toBe("French electronic duo from Paris.");
    expect(res.body.country).toBe("FR");
  });

  it("T-ARTIST-003 — missing name returns 400", async () => {
    const res = await request(buildApp()).post("/artists").set("x-test-user", SAEED).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("T-ARTIST-004 — case-insensitive name collision (TAYLOR SWIFT vs Taylor Swift) is a 409", async () => {
    seedArtist({
      id: "art_taylor_swift",
      name: "Taylor Swift",
      name_lc: "taylor swift",
      slug: "taylor-swift",
      status: "published",
    });
    const res = await request(buildApp())
      .post("/artists")
      .set("x-test-user", SAEED)
      .send({ name: "TAYLOR SWIFT" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(res.body.message).toMatch(/already exists/);
  });

  it("T-ARTIST-005 — different name but same slug ('Taylor Swift!' → taylor-swift) also 409s", async () => {
    seedArtist({
      id: "art_taylor_swift",
      name: "Taylor Swift",
      name_lc: "taylor swift",
      slug: "taylor-swift",
      status: "published",
    });
    const res = await request(buildApp())
      .post("/artists")
      .set("x-test-user", SAEED)
      .send({ name: "Taylor Swift!" });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/slug/);
  });

  it("T-ARTIST-006 — country must be ISO 3166-1 alpha-2 ('Netherlands' is rejected, 'NL' is fine)", async () => {
    const res = await request(buildApp())
      .post("/artists")
      .set("x-test-user", SAEED)
      .send({ name: "Tiësto", country: "Netherlands" });
    expect(res.status).toBe(400);
  });

  it("T-ARTIST-006b — emoji-only name '✨🎵' falls back to slug 'artist'", async () => {
    const res = await request(buildApp())
      .post("/artists")
      .set("x-test-user", SAEED)
      .send({ name: "✨🎵" });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe("artist");
  });

  it("T-ARTIST-006c — passing an imageObjectPath persists it on the artist doc", async () => {
    const res = await request(buildApp()).post("/artists").set("x-test-user", SAEED).send({
      name: "Billie Eilish",
      imageObjectPath: "artist-images/usr_saeed_h/billie-headshot.jpg",
    });
    expect(res.status).toBe(201);
    expect(res.body.imageObjectPath).toBe("artist-images/usr_saeed_h/billie-headshot.jpg");
  });
});

describe("GET /artists — listing artists (CTR-102)", () => {
  it("T-ARTIST-007 — customers only see published artists by default", async () => {
    seedArtist({ id: "art_taylor_swift", status: "published", ownerUid: "usr_jamie_lee" });
    seedArtist({ id: "art_billie_eilish", status: "pending", ownerUid: "usr_jamie_lee" });
    seedArtist({ id: "art_unverified_x", status: "rejected", ownerUid: "usr_jamie_lee" });
    const res = await request(buildApp()).get("/artists").set("x-test-user", SAEED);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe("art_taylor_swift");
  });

  it("T-ARTIST-008 — admin sees everything when no filter is set", async () => {
    seedArtist({ id: "art_taylor_swift", status: "published" });
    seedArtist({ id: "art_billie_eilish", status: "pending" });
    seedArtist({ id: "art_unverified_x", status: "rejected" });
    const res = await request(buildApp()).get("/artists").set("x-test-user", MARCUS);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);
  });

  it("T-ARTIST-009 — admin can ask for just pending artists", async () => {
    seedArtist({ id: "art_taylor_swift", status: "published" });
    seedArtist({ id: "art_billie_eilish", status: "pending" });
    const res = await request(buildApp()).get("/artists?status=pending").set("x-test-user", MARCUS);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].status).toBe("pending");
  });

  it("T-ARTIST-010 — admin can pass a comma list (?status=pending,rejected)", async () => {
    seedArtist({ id: "art_taylor_swift", status: "published" });
    seedArtist({ id: "art_billie_eilish", status: "pending" });
    seedArtist({ id: "art_unverified_x", status: "rejected" });
    const res = await request(buildApp())
      .get("/artists?status=pending,rejected")
      .set("x-test-user", MARCUS);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
  });

  it("T-ARTIST-011 — empty status filter is treated as 'no filter'", async () => {
    seedArtist({ id: "art_taylor_swift", status: "published" });
    seedArtist({ id: "art_billie_eilish", status: "pending" });
    const res = await request(buildApp()).get("/artists?status=").set("x-test-user", MARCUS);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
  });

  it("T-ARTIST-011b — garbage status values like 'banana,kiwi' are also ignored", async () => {
    seedArtist({ id: "art_taylor_swift", status: "published" });
    seedArtist({ id: "art_billie_eilish", status: "pending" });
    const res = await request(buildApp())
      .get("/artists?status=banana,kiwi")
      .set("x-test-user", MARCUS);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
  });

  it("T-ARTIST-012 — admin can scope to a specific owner via ?ownerUid=", async () => {
    seedArtist({ id: "art_taylor_swift", ownerUid: "usr_saeed_h", status: "published" });
    seedArtist({ id: "art_billie_eilish", ownerUid: "usr_jamie_lee", status: "published" });
    const res = await request(buildApp())
      .get("/artists?ownerUid=usr_saeed_h")
      .set("x-test-user", MARCUS);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].ownerUid).toBe("usr_saeed_h");
  });

  it("T-ARTIST-013 — Saeed asking for ownerUid=self sees his own pending+rejected too", async () => {
    seedArtist({ id: "art_pending_a", ownerUid: "usr_saeed_h", status: "pending" });
    seedArtist({ id: "art_rejected_b", ownerUid: "usr_saeed_h", status: "rejected" });
    seedArtist({ id: "art_other_c", ownerUid: "usr_jamie_lee", status: "pending" });
    const res = await request(buildApp())
      .get("/artists?ownerUid=usr_saeed_h&status=pending,rejected")
      .set("x-test-user", SAEED);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.every((a: Artist) => a.ownerUid === "usr_saeed_h")).toBe(true);
  });

  it("T-ARTIST-013b — Saeed can filter his own artists down to just 'pending'", async () => {
    seedArtist({ id: "art_pending_a", ownerUid: "usr_saeed_h", status: "pending" });
    seedArtist({ id: "art_published_b", ownerUid: "usr_saeed_h", status: "published" });
    const res = await request(buildApp())
      .get("/artists?ownerUid=usr_saeed_h&status=pending")
      .set("x-test-user", SAEED);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].status).toBe("pending");
  });

  it("T-ARTIST-014 — if Saeed asks for someone else's ownerUid he still only gets published ones", async () => {
    seedArtist({ id: "art_jamie_pub", ownerUid: "usr_jamie_lee", status: "published" });
    seedArtist({ id: "art_jamie_pend", ownerUid: "usr_jamie_lee", status: "pending" });
    const res = await request(buildApp())
      .get("/artists?ownerUid=usr_jamie_lee")
      .set("x-test-user", SAEED);
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe("art_jamie_pub");
  });

  it("T-ARTIST-014a — listing omits generated imageUrl when Storage read signing fails", async () => {
    seedArtist({
      id: "art_jamie_pub",
      ownerUid: "usr_jamie_lee",
      status: "published",
      imageObjectPath: "artist-images/jamie/headshot.jpg",
    });
    storageBehaviour.signedUrlMode = "throw";
    const res = await request(buildApp()).get("/artists").set("x-test-user", SAEED);
    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({
      id: "art_jamie_pub",
      imageObjectPath: "artist-images/jamie/headshot.jpg",
    });
    expect(res.body.items[0]).not.toHaveProperty("imageUrl");
  });

  it("T-ARTIST-014d — local Storage emulator returns a browser-readable media URL", async () => {
    stubEnv.FIREBASE_STORAGE_EMULATOR_HOST = "127.0.0.1:9199";
    seedArtist({
      id: "art_jamie_pub",
      ownerUid: "usr_jamie_lee",
      status: "published",
      imageObjectPath: "artist-images/jamie/head shot.jpg",
    });
    const res = await request(buildApp()).get("/artists").set("x-test-user", SAEED);
    expect(res.status).toBe(200);
    expect(res.body.items[0].imageUrl).toBe(
      "http://127.0.0.1:9199/v0/b/muga-test.appspot.com/o/artist-images%2Fjamie%2Fhead%20shot.jpg?alt=media"
    );
  });

  it("T-ARTIST-014e — local Storage emulator preserves an explicit http origin", async () => {
    stubEnv.FIREBASE_STORAGE_EMULATOR_HOST = "http://localhost:9199";
    seedArtist({
      id: "art_jamie_pub",
      ownerUid: "usr_jamie_lee",
      status: "published",
      imageObjectPath: "artist-images/jamie/headshot.jpg",
    });
    const res = await request(buildApp()).get("/artists").set("x-test-user", SAEED);
    expect(res.status).toBe(200);
    expect(res.body.items[0].imageUrl).toBe(
      "http://localhost:9199/v0/b/muga-test.appspot.com/o/artist-images%2Fjamie%2Fheadshot.jpg?alt=media"
    );
  });

  it("T-ARTIST-014b — listing without auth → 401", async () => {
    const res = await request(buildApp()).get("/artists");
    expect(res.status).toBe(401);
  });

  it("T-ARTIST-014c — Firestore blowing up during list shows up as 500", async () => {
    dbBehaviour.listMode = "throw";
    const res = await request(buildApp()).get("/artists").set("x-test-user", MARCUS);
    expect(res.status).toBe(500);
  });
});

describe("GET /artists/:id — reading a single artist (CTR-103)", () => {
  it("T-ARTIST-015 — anyone logged in can read a published artist", async () => {
    seedArtist({ id: "art_taylor_swift", status: "published", ownerUid: "usr_jamie_lee" });
    const res = await request(buildApp())
      .get("/artists/art_taylor_swift")
      .set("x-test-user", SAEED);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("art_taylor_swift");
  });

  it("T-ARTIST-016 — Saeed can read his own pending artist while it waits for review", async () => {
    seedArtist({ id: "art_pending_x", status: "pending", ownerUid: "usr_saeed_h" });
    const res = await request(buildApp()).get("/artists/art_pending_x").set("x-test-user", SAEED);
    expect(res.status).toBe(200);
  });

  it("T-ARTIST-017 — pending artists owned by someone else 404 to non-admins (we hide them)", async () => {
    seedArtist({ id: "art_jamies_secret", status: "pending", ownerUid: "usr_jamie_lee" });
    const res = await request(buildApp())
      .get("/artists/art_jamies_secret")
      .set("x-test-user", SAEED);
    expect(res.status).toBe(404);
  });

  it("T-ARTIST-017b — admin can still read anyone's pending artist", async () => {
    seedArtist({ id: "art_jamies_secret", status: "pending", ownerUid: "usr_jamie_lee" });
    const res = await request(buildApp())
      .get("/artists/art_jamies_secret")
      .set("x-test-user", MARCUS);
    expect(res.status).toBe(200);
  });

  it("T-ARTIST-018 — totally unknown id → 404", async () => {
    const res = await request(buildApp())
      .get("/artists/art_does_not_exist")
      .set("x-test-user", SAEED);
    expect(res.status).toBe(404);
  });
});

describe("PATCH /artists/:id — updating an artist (CTR-104)", () => {
  it("T-ARTIST-019 — owner adds a bio without renaming → name_lc/slug stay put", async () => {
    seedArtist({
      id: "art_radiohead",
      ownerUid: "usr_saeed_h",
      name: "Radiohead",
      name_lc: "radiohead",
      slug: "radiohead",
    });
    const res = await request(buildApp())
      .patch("/artists/art_radiohead")
      .set("x-test-user", SAEED)
      .send({ bio: "British rock band formed in Abingdon, Oxfordshire in 1985." });
    expect(res.status).toBe(200);
    expect(res.body.bio).toBe("British rock band formed in Abingdon, Oxfordshire in 1985.");
    expect(res.body.name_lc).toBe("radiohead");
    expect(res.body.slug).toBe("radiohead");
  });

  it("T-ARTIST-020 — admin can edit anyone's artist, even if they don't own it", async () => {
    seedArtist({
      id: "art_kendrick",
      ownerUid: "usr_jamie_lee",
      name: "Kendrick Lamar",
      name_lc: "kendrick lamar",
      slug: "kendrick-lamar",
    });
    const res = await request(buildApp())
      .patch("/artists/art_kendrick")
      .set("x-test-user", MARCUS)
      .send({ bio: "Pulitzer Prize winning rapper from Compton, CA." });
    expect(res.status).toBe(200);
    expect(res.body.bio).toBe("Pulitzer Prize winning rapper from Compton, CA.");
  });

  it("T-ARTIST-021 — Jamie trying to edit Saeed's artist gets 403", async () => {
    seedArtist({ id: "art_radiohead", ownerUid: "usr_saeed_h" });
    const res = await request(buildApp())
      .patch("/artists/art_radiohead")
      .set("x-test-user", JAMIE)
      .send({ bio: "hijack attempt" });
    expect(res.status).toBe(403);
  });

  it("T-ARTIST-021b — patching a non-existent artist → 404", async () => {
    const res = await request(buildApp())
      .patch("/artists/art_ghost")
      .set("x-test-user", SAEED)
      .send({ bio: "x" });
    expect(res.status).toBe(404);
  });

  it("T-ARTIST-022 — renaming an artist regenerates name_lc + slug and rechecks uniqueness", async () => {
    seedArtist({
      id: "art_taylor_swift",
      ownerUid: "usr_saeed_h",
      name: "Taylor Swift",
      name_lc: "taylor swift",
      slug: "taylor-swift",
    });
    const res = await request(buildApp())
      .patch("/artists/art_taylor_swift")
      .set("x-test-user", SAEED)
      .send({ name: "Taylor Alison Swift" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Taylor Alison Swift");
    expect(res.body.name_lc).toBe("taylor alison swift");
    expect(res.body.slug).toBe("taylor-alison-swift");
  });

  it("T-ARTIST-022b — renaming into another existing artist's name → 409", async () => {
    seedArtist({
      id: "art_taylor_swift",
      ownerUid: "usr_saeed_h",
      name: "Taylor Swift",
      name_lc: "taylor swift",
      slug: "taylor-swift",
    });
    seedArtist({
      id: "art_the_beatles",
      ownerUid: "usr_jamie_lee",
      name: "The Beatles",
      name_lc: "the beatles",
      slug: "the-beatles",
      status: "published",
    });
    const res = await request(buildApp())
      .patch("/artists/art_taylor_swift")
      .set("x-test-user", SAEED)
      .send({ name: "The Beatles" });
    expect(res.status).toBe(409);
  });

  it("T-ARTIST-023 — patching with the same name (no-op rename) is fine — we exclude self from the check", async () => {
    seedArtist({
      id: "art_taylor_swift",
      ownerUid: "usr_saeed_h",
      name: "Taylor Swift",
      name_lc: "taylor swift",
      slug: "taylor-swift",
    });
    const res = await request(buildApp())
      .patch("/artists/art_taylor_swift")
      .set("x-test-user", SAEED)
      .send({ name: "Taylor Swift" });
    expect(res.status).toBe(200);
  });

  it("T-ARTIST-023b — patch with a bad country code (e.g. 'Netherlands') → 400", async () => {
    seedArtist({ id: "art_tiesto", ownerUid: "usr_saeed_h" });
    const res = await request(buildApp())
      .patch("/artists/art_tiesto")
      .set("x-test-user", SAEED)
      .send({ country: "Netherlands" });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /artists/:id — deleting an artist (CTR-105)", () => {
  it("T-ARTIST-024 — owner can delete their own artist when no products reference it", async () => {
    seedArtist({ id: "art_taylor_swift", ownerUid: "usr_saeed_h" });
    const res = await request(buildApp())
      .delete("/artists/art_taylor_swift")
      .set("x-test-user", SAEED);
    expect(res.status).toBe(204);
    expect(store.has("art_taylor_swift")).toBe(false);
  });

  it("T-ARTIST-024b — admin can delete any artist", async () => {
    seedArtist({ id: "art_taylor_swift", ownerUid: "usr_jamie_lee" });
    const res = await request(buildApp())
      .delete("/artists/art_taylor_swift")
      .set("x-test-user", MARCUS);
    expect(res.status).toBe(204);
  });

  it("T-ARTIST-024c — also cleans up the artist's image from Storage (best-effort)", async () => {
    seedArtist({
      id: "art_taylor_swift",
      ownerUid: "usr_saeed_h",
      imageObjectPath: "artist-images/usr_saeed_h/taylor.jpg",
    });
    const res = await request(buildApp())
      .delete("/artists/art_taylor_swift")
      .set("x-test-user", SAEED);
    expect(res.status).toBe(204);
    expect(objectDeleteCalls).toContain("artist-images/usr_saeed_h/taylor.jpg");
  });

  it("T-ARTIST-024d — if the image delete fails we still succeed — image cleanup is best-effort", async () => {
    seedArtist({
      id: "art_taylor_swift",
      ownerUid: "usr_saeed_h",
      imageObjectPath: "artist-images/usr_saeed_h/taylor.jpg",
    });
    storageBehaviour.objectDeleteMode = "throw";
    const res = await request(buildApp())
      .delete("/artists/art_taylor_swift")
      .set("x-test-user", SAEED);
    expect(res.status).toBe(204);
    expect(store.has("art_taylor_swift")).toBe(false);
  });

  it("T-ARTIST-025 — Jamie can't delete Saeed's artist → 403, doc stays put", async () => {
    seedArtist({ id: "art_taylor_swift", ownerUid: "usr_saeed_h" });
    const res = await request(buildApp())
      .delete("/artists/art_taylor_swift")
      .set("x-test-user", JAMIE);
    expect(res.status).toBe(403);
    expect(store.has("art_taylor_swift")).toBe(true);
  });

  it("T-ARTIST-025b — deleting an artist that doesn't exist → 404", async () => {
    const res = await request(buildApp()).delete("/artists/art_ghost").set("x-test-user", SAEED);
    expect(res.status).toBe(404);
  });

  it("T-ARTIST-026 — can't delete an artist that still has a product attached → 409 with that product id", async () => {
    seedArtist({ id: "art_taylor_swift", ownerUid: "usr_saeed_h" });
    seedProduct("prod_midnights", "art_taylor_swift");
    const res = await request(buildApp())
      .delete("/artists/art_taylor_swift")
      .set("x-test-user", SAEED);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(res.body.details.blockingProductIds).toEqual(["prod_midnights"]);
    expect(res.body.details.hasMore).toBe(false);
    expect(store.has("art_taylor_swift")).toBe(true);
  });

  it("T-ARTIST-027 — five blocking products → all five returned, hasMore=false", async () => {
    seedArtist({ id: "art_taylor_swift", ownerUid: "usr_saeed_h" });
    const albums = ["prod_1989", "prod_folklore", "prod_midnights", "prod_lover", "prod_red"];
    albums.forEach((id) => seedProduct(id, "art_taylor_swift"));
    const res = await request(buildApp())
      .delete("/artists/art_taylor_swift")
      .set("x-test-user", SAEED);
    expect(res.status).toBe(409);
    expect(res.body.details.blockingProductIds).toHaveLength(5);
    expect(res.body.details.hasMore).toBe(false);
  });

  it("T-ARTIST-028 — six blocking products → cap at five, hasMore=true", async () => {
    seedArtist({ id: "art_taylor_swift", ownerUid: "usr_saeed_h" });
    const albums = [
      "prod_1989",
      "prod_folklore",
      "prod_midnights",
      "prod_lover",
      "prod_red",
      "prod_evermore",
    ];
    albums.forEach((id) => seedProduct(id, "art_taylor_swift"));
    const res = await request(buildApp())
      .delete("/artists/art_taylor_swift")
      .set("x-test-user", SAEED);
    expect(res.status).toBe(409);
    expect(res.body.details.blockingProductIds).toHaveLength(5);
    expect(res.body.details.hasMore).toBe(true);
  });

  it("T-ARTIST-029 — admin is also blocked by referencing products (no override here)", async () => {
    seedArtist({ id: "art_taylor_swift", ownerUid: "usr_jamie_lee" });
    seedProduct("prod_midnights", "art_taylor_swift");
    const res = await request(buildApp())
      .delete("/artists/art_taylor_swift")
      .set("x-test-user", MARCUS);
    expect(res.status).toBe(409);
  });

  it("T-ARTIST-030 — artists with no imageObjectPath skip the storage delete call entirely", async () => {
    seedArtist({ id: "art_taylor_swift", ownerUid: "usr_saeed_h" });
    const res = await request(buildApp())
      .delete("/artists/art_taylor_swift")
      .set("x-test-user", SAEED);
    expect(res.status).toBe(204);
    expect(objectDeleteCalls).toHaveLength(0);
  });
});

describe("POST /artists/:id/approve|reject — admin moderation (CTR-106, CTR-107)", () => {
  it("T-ARTIST-031 — Marcus approves Saeed's pending artist → status flips to published with audit fields", async () => {
    seedArtist({
      id: "art_taylor_swift",
      status: "pending",
      ownerUid: "usr_saeed_h",
    });
    const res = await request(buildApp())
      .post("/artists/art_taylor_swift/approve")
      .set("x-test-user", MARCUS)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("published");
    expect(res.body.approvedBy).toBe("usr_marcus_admin");
    expect(typeof res.body.approvedAt).toBe("string");
    expect(typeof res.body.updatedAt).toBe("string");
  });

  it("T-ARTIST-031b — non-admins can't approve → 403", async () => {
    seedArtist({ id: "art_taylor_swift", status: "pending" });
    const res = await request(buildApp())
      .post("/artists/art_taylor_swift/approve")
      .set("x-test-user", SAEED)
      .send({});
    expect(res.status).toBe(403);
  });

  it("T-ARTIST-032 — approving an artist that doesn't exist → 404", async () => {
    const res = await request(buildApp())
      .post("/artists/art_ghost/approve")
      .set("x-test-user", MARCUS)
      .send({});
    expect(res.status).toBe(404);
  });

  it("T-ARTIST-033 — approving an already-published artist → 409 (no double-approve)", async () => {
    seedArtist({
      id: "art_taylor_swift",
      status: "published",
      approvedAt: "2026-05-01T00:00:00.000Z",
      approvedBy: "usr_marcus_admin",
    });
    const res = await request(buildApp())
      .post("/artists/art_taylor_swift/approve")
      .set("x-test-user", MARCUS)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("CONFLICT");
    expect(res.body.message).toMatch(/already published/i);
  });

  it("T-ARTIST-034 — admin rejects with a reason → status=rejected, reason persisted", async () => {
    seedArtist({ id: "art_taylor_swift", status: "pending" });
    const res = await request(buildApp())
      .post("/artists/art_taylor_swift/reject")
      .set("x-test-user", MARCUS)
      .send({ reason: "Name conflicts with an existing trademark" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("rejected");
    expect(res.body.rejectionReason).toBe("Name conflicts with an existing trademark");
  });

  it("T-ARTIST-034b — rejecting with no body falls back to 'Rejected by admin'", async () => {
    seedArtist({ id: "art_taylor_swift", status: "pending" });
    const res = await request(buildApp())
      .post("/artists/art_taylor_swift/reject")
      .set("x-test-user", MARCUS)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.rejectionReason).toBe("Rejected by admin");
  });

  it("T-ARTIST-034c — non-string reason (e.g. a number) also falls back to the default", async () => {
    seedArtist({ id: "art_taylor_swift", status: "pending" });
    const res = await request(buildApp())
      .post("/artists/art_taylor_swift/reject")
      .set("x-test-user", MARCUS)
      .send({ reason: 12345 });
    expect(res.status).toBe(200);
    expect(res.body.rejectionReason).toBe("Rejected by admin");
  });

  it("T-ARTIST-034d — Saeed (customer) can't reject an artist → 403", async () => {
    seedArtist({ id: "art_taylor_swift", status: "pending" });
    const res = await request(buildApp())
      .post("/artists/art_taylor_swift/reject")
      .set("x-test-user", SAEED)
      .send({ reason: "x" });
    expect(res.status).toBe(403);
  });

  it("T-ARTIST-034e — rejecting a non-existent artist → 404", async () => {
    const res = await request(buildApp())
      .post("/artists/art_ghost/reject")
      .set("x-test-user", MARCUS)
      .send({});
    expect(res.status).toBe(404);
  });

  it("T-ARTIST-034f — reject with no body at all (not even {}) still works", async () => {
    seedArtist({ id: "art_taylor_swift", status: "pending" });
    const res = await request(buildApp())
      .post("/artists/art_taylor_swift/reject")
      .set("x-test-user", MARCUS);
    expect(res.status).toBe(200);
    expect(res.body.rejectionReason).toBe("Rejected by admin");
  });

  it("T-ARTIST-035 — admin re-approves a previously-rejected artist; old rejectionReason is kept for audit", async () => {
    seedArtist({
      id: "art_taylor_swift",
      status: "rejected",
      rejectionReason: "Initial reason — name flagged",
    });
    const res = await request(buildApp())
      .post("/artists/art_taylor_swift/approve")
      .set("x-test-user", MARCUS)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("published");
    expect(res.body.approvedBy).toBe("usr_marcus_admin");
    expect(res.body.rejectionReason).toBe("Initial reason — name flagged");
  });

  it("T-ARTIST-036 — admin pulls down a published artist; approvedAt/By stays for audit trail", async () => {
    seedArtist({
      id: "art_taylor_swift",
      status: "published",
      approvedAt: "2026-05-01T00:00:00.000Z",
      approvedBy: "usr_other_admin",
    });
    const res = await request(buildApp())
      .post("/artists/art_taylor_swift/reject")
      .set("x-test-user", MARCUS)
      .send({ reason: "Pulled down — guideline breach" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("rejected");
    expect(res.body.rejectionReason).toBe("Pulled down — guideline breach");
    expect(res.body.approvedAt).toBe("2026-05-01T00:00:00.000Z");
    expect(res.body.approvedBy).toBe("usr_other_admin");
  });
});
