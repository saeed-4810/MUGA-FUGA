const errorResponse = { $ref: "#/components/responses/Error" };
const productResponse = {
  description: "Product",
  content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } },
};
const artistResponse = {
  description: "Artist",
  content: { "application/json": { schema: { $ref: "#/components/schemas/Artist" } } },
};

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "MUGA API",
    version: "0.1.0",
    description:
      "REST API for music product and artist management. The API uses Firebase Auth bearer tokens, " +
      "admin/customer RBAC, signed Storage upload URLs, product and artist moderation, and structured " +
      "request logging with x-request-id correlation.",
  },
  servers: [
    { url: "http://localhost:3001/api", description: "Local backend" },
    { url: "https://muga-staging.web.app/api", description: "Staging via Firebase Hosting" },
    { url: "https://muga-production.web.app/api", description: "Production via Firebase Hosting" },
  ],
  tags: [
    { name: "health", description: "Liveness and readiness probes" },
    { name: "auth", description: "Authenticated user bootstrap" },
    { name: "products", description: "Product CRUD, uploads, and moderation" },
    { name: "artists", description: "Artist CRUD, uploads, and moderation" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Firebase ID token",
      },
    },
    responses: {
      Error: {
        description: "Canonical error envelope",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
      },
      NoContent: { description: "No content" },
    },
    schemas: {
      ErrorEnvelope: {
        type: "object",
        required: ["code", "message", "requestId"],
        properties: {
          code: { type: "string", example: "VALIDATION_ERROR" },
          message: { type: "string" },
          requestId: { type: "string" },
          details: { type: "object", additionalProperties: true },
        },
      },
      AuthUser: {
        type: "object",
        required: ["uid", "email", "role"],
        properties: {
          uid: { type: "string" },
          email: { type: "string", format: "email" },
          role: { type: "string", enum: ["admin", "customer"] },
          emailVerified: { type: "boolean" },
        },
      },
      HealthResponse: {
        type: "object",
        required: ["status", "service", "timestamp"],
        properties: {
          status: { type: "string", enum: ["ok"] },
          service: { type: "string", example: "muga-backend" },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      ReadinessResponse: {
        type: "object",
        required: ["status", "firestore", "latency_ms", "timestamp"],
        properties: {
          status: { type: "string", enum: ["ready"] },
          firestore: { type: "string", enum: ["ok"] },
          latency_ms: { type: "integer", minimum: 0 },
          timestamp: { type: "string", format: "date-time" },
        },
      },
      SignedUploadRequest: {
        type: "object",
        required: ["contentType", "fileSize"],
        properties: {
          contentType: { type: "string", enum: ["image/jpeg", "image/png", "image/webp"] },
          fileSize: { type: "integer", minimum: 1, maximum: 5242880 },
        },
      },
      SignedUploadResponse: {
        type: "object",
        required: ["uploadUrl", "objectPath", "expiresAt"],
        properties: {
          uploadUrl: { type: "string", format: "uri" },
          objectPath: { type: "string" },
          expiresAt: { type: "string", format: "date-time" },
        },
      },
      ProductArtist: {
        type: "object",
        required: ["id", "name", "status"],
        properties: {
          id: { type: "string" },
          name: { type: "string", maxLength: 120 },
          imageUrl: { type: "string", format: "uri" },
          status: { type: "string", enum: ["pending", "published", "rejected"] },
        },
      },
      Product: {
        type: "object",
        required: [
          "id",
          "name",
          "artistId",
          "artist",
          "coverArtPath",
          "status",
          "ownerUid",
          "ownerEmail",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          id: { type: "string" },
          name: { type: "string", maxLength: 120 },
          artistId: { type: "string" },
          artist: { $ref: "#/components/schemas/ProductArtist" },
          coverArtPath: { type: "string" },
          coverArtUrl: { type: "string", format: "uri" },
          status: { type: "string", enum: ["pending", "published", "rejected"] },
          ownerUid: { type: "string" },
          ownerEmail: { type: "string", format: "email" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          approvedAt: { type: "string", format: "date-time" },
          approvedBy: { type: "string" },
          rejectionReason: { type: "string" },
        },
      },
      ProductList: {
        type: "object",
        required: ["items"],
        properties: { items: { type: "array", items: { $ref: "#/components/schemas/Product" } } },
      },
      CreateProductInput: {
        type: "object",
        required: ["name", "artistId", "coverArtPath"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120 },
          artistId: { type: "string" },
          coverArtPath: { type: "string" },
        },
      },
      UpdateProductInput: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120 },
          artistId: { type: "string" },
          coverArtPath: { type: "string" },
        },
      },
      Artist: {
        type: "object",
        required: [
          "id",
          "name",
          "name_lc",
          "slug",
          "status",
          "ownerUid",
          "ownerEmail",
          "createdAt",
          "updatedAt",
        ],
        properties: {
          id: { type: "string" },
          name: { type: "string", maxLength: 120 },
          name_lc: { type: "string", maxLength: 120, description: "Case-insensitive lookup field" },
          slug: { type: "string", maxLength: 140 },
          bio: { type: "string", maxLength: 2000 },
          imageUrl: { type: "string", format: "uri" },
          imageObjectPath: { type: "string" },
          country: { type: "string", pattern: "^[A-Z]{2}$", description: "ISO 3166-1 alpha-2" },
          status: { type: "string", enum: ["pending", "published", "rejected"] },
          ownerUid: { type: "string" },
          ownerEmail: { type: "string", format: "email" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          approvedAt: { type: "string", format: "date-time" },
          approvedBy: { type: "string" },
          rejectionReason: { type: "string" },
        },
      },
      ArtistList: {
        type: "object",
        required: ["items"],
        properties: { items: { type: "array", items: { $ref: "#/components/schemas/Artist" } } },
      },
      CreateArtistInput: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120 },
          bio: { type: "string", maxLength: 2000 },
          country: { type: "string", pattern: "^[A-Z]{2}$" },
          imageObjectPath: { type: "string" },
        },
      },
      UpdateArtistInput: {
        type: "object",
        properties: {
          name: { type: "string", minLength: 1, maxLength: 120 },
          bio: { type: "string", maxLength: 2000 },
          country: { type: "string", pattern: "^[A-Z]{2}$" },
          imageObjectPath: { type: "string" },
        },
      },
      RejectInput: {
        type: "object",
        properties: { reason: { type: "string", maxLength: 500 } },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/health": {
      get: {
        tags: ["health"],
        security: [],
        summary: "Liveness probe",
        responses: {
          "200": {
            description: "Backend process is alive",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/HealthResponse" } },
            },
          },
        },
      },
    },
    "/healthz/ready": {
      get: {
        tags: ["health"],
        security: [],
        summary: "Readiness probe with Firestore check",
        responses: {
          "200": {
            description: "Backend is ready and Firestore responded",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ReadinessResponse" } },
            },
          },
          "500": errorResponse,
        },
      },
    },
    "/me": {
      get: {
        tags: ["auth"],
        summary: "Current authenticated user (CTR-001)",
        responses: {
          "200": {
            description: "Authenticated user",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthUser" } } },
          },
          "401": errorResponse,
        },
      },
    },
    "/me/bootstrap": {
      post: {
        tags: ["auth"],
        summary: "First-sign-in role bootstrap (CTR-001b)",
        responses: {
          "200": {
            ...productResponse,
            description: "User role confirmed",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthUser" } } },
          },
          "401": errorResponse,
        },
      },
    },
    "/products/signed-upload": {
      post: {
        tags: ["products"],
        summary: "Issue cover-art upload signed URL (CTR-002)",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/SignedUploadRequest" } },
          },
        },
        responses: {
          "201": {
            description: "Signed URL issued",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/SignedUploadResponse" } },
            },
          },
          "400": errorResponse,
          "401": errorResponse,
        },
      },
    },
    "/products": {
      post: {
        tags: ["products"],
        summary: "Create product (CTR-003)",
        description:
          "Customers create pending products. Admin-created products are published immediately. Product writes validate the artistId foreign key.",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateProductInput" } },
          },
        },
        responses: {
          "201": productResponse,
          "400": errorResponse,
          "401": errorResponse,
          "422": errorResponse,
        },
      },
      get: {
        tags: ["products"],
        summary: "List products (CTR-004)",
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["pending", "published", "rejected"] },
            description:
              "Admin-only status filter. Customers receive published products plus their own pending products.",
          },
        ],
        responses: {
          "200": {
            description: "Visible products",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ProductList" } },
            },
          },
          "401": errorResponse,
        },
      },
    },
    "/products/{id}": {
      get: {
        tags: ["products"],
        summary: "Read product (CTR-005)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": productResponse,
          "401": errorResponse,
          "404": errorResponse,
          "422": errorResponse,
        },
      },
      patch: {
        tags: ["products"],
        summary: "Update product (CTR-006)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/UpdateProductInput" } },
          },
        },
        responses: {
          "200": productResponse,
          "400": errorResponse,
          "401": errorResponse,
          "403": errorResponse,
          "404": errorResponse,
          "422": errorResponse,
        },
      },
      delete: {
        tags: ["products"],
        summary: "Delete product (CTR-007)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "204": { $ref: "#/components/responses/NoContent" },
          "401": errorResponse,
          "403": errorResponse,
          "404": errorResponse,
        },
      },
    },
    "/products/{id}/approve": {
      post: {
        tags: ["products"],
        summary: "Admin approve product (CTR-008)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": productResponse,
          "401": errorResponse,
          "403": errorResponse,
          "404": errorResponse,
          "409": errorResponse,
        },
      },
    },
    "/products/{id}/reject": {
      post: {
        tags: ["products"],
        summary: "Admin reject product (CTR-009)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: false,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RejectInput" } } },
        },
        responses: {
          "200": productResponse,
          "401": errorResponse,
          "403": errorResponse,
          "404": errorResponse,
        },
      },
    },
    "/artists/signed-upload": {
      post: {
        tags: ["artists"],
        summary: "Issue artist-image upload signed URL (CTR-100)",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/SignedUploadRequest" } },
          },
        },
        responses: {
          "201": {
            description: "Signed URL issued",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/SignedUploadResponse" } },
            },
          },
          "400": errorResponse,
          "401": errorResponse,
        },
      },
    },
    "/artists": {
      post: {
        tags: ["artists"],
        summary: "Create artist (CTR-101)",
        description:
          "Customers create pending artists. Admin-created artists are published immediately.",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/CreateArtistInput" } },
          },
        },
        responses: {
          "201": artistResponse,
          "400": errorResponse,
          "401": errorResponse,
          "409": errorResponse,
        },
      },
      get: {
        tags: ["artists"],
        summary: "List artists (CTR-102)",
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", example: "pending,rejected" },
            description:
              "Single status or comma list. Admins may filter all artists; customers can filter their own artists.",
          },
          {
            name: "ownerUid",
            in: "query",
            schema: { type: "string" },
            description: "Admin owner filter; customers may use their own uid.",
          },
        ],
        responses: {
          "200": {
            description: "Visible artists",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ArtistList" } },
            },
          },
          "401": errorResponse,
        },
      },
    },
    "/artists/{id}": {
      get: {
        tags: ["artists"],
        summary: "Read artist (CTR-103)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": artistResponse, "401": errorResponse, "404": errorResponse },
      },
      patch: {
        tags: ["artists"],
        summary: "Update artist (CTR-104)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/UpdateArtistInput" } },
          },
        },
        responses: {
          "200": artistResponse,
          "400": errorResponse,
          "401": errorResponse,
          "403": errorResponse,
          "404": errorResponse,
          "409": errorResponse,
        },
      },
      delete: {
        tags: ["artists"],
        summary: "Delete artist (CTR-105)",
        description:
          "Returns 409 when products still reference the artist. The error details include blockingProductIds.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "204": { $ref: "#/components/responses/NoContent" },
          "401": errorResponse,
          "403": errorResponse,
          "404": errorResponse,
          "409": errorResponse,
        },
      },
    },
    "/artists/{id}/approve": {
      post: {
        tags: ["artists"],
        summary: "Admin approve artist (CTR-106)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": artistResponse,
          "401": errorResponse,
          "403": errorResponse,
          "404": errorResponse,
          "409": errorResponse,
        },
      },
    },
    "/artists/{id}/reject": {
      post: {
        tags: ["artists"],
        summary: "Admin reject artist (CTR-107)",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: false,
          content: { "application/json": { schema: { $ref: "#/components/schemas/RejectInput" } } },
        },
        responses: {
          "200": artistResponse,
          "401": errorResponse,
          "403": errorResponse,
          "404": errorResponse,
        },
      },
    },
  },
} as const;
