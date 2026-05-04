/**
 * MUGA OpenAPI 3.1 spec.
 * Hand-curated to keep zero runtime overhead. Mirrors `docs/api/api-spec.md`
 * (CTR-001 .. CTR-009).
 */
export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "MUGA API",
    version: "0.1.0",
    description:
      "Music product management — CRUD over `products` with admin-approval workflow, " +
      "Google-auth-only via Firebase Auth, cover-art via signed-URL upload to Firebase Storage.",
  },
  servers: [
    { url: "http://localhost:3001", description: "Local" },
    { url: "https://api.staging.muga.app", description: "Staging" },
    { url: "https://api.muga.app", description: "Production" },
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
    schemas: {
      ErrorEnvelope: {
        type: "object",
        required: ["code", "message", "requestId"],
        properties: {
          code: { type: "string" },
          message: { type: "string" },
          requestId: { type: "string" },
          details: { type: "object", additionalProperties: true },
        },
      },
      Product: {
        type: "object",
        required: [
          "id",
          "name",
          "artistName",
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
          artistName: { type: "string", maxLength: 120 },
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
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/health": {
      get: {
        security: [],
        summary: "Liveness probe",
        responses: { "200": { description: "OK" } },
      },
    },
    "/me": {
      get: {
        summary: "Current authenticated user (CTR-001)",
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { $ref: "#/components/schemas/AuthUser" } } },
          },
          "401": {
            description: "Unauthenticated",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } },
            },
          },
        },
      },
    },
    "/me/bootstrap": {
      post: {
        summary: "First-sign-in role bootstrap",
        responses: { "200": { description: "OK" } },
      },
    },
    "/products/signed-upload": {
      post: {
        summary: "Issue cover-art upload signed URL (CTR-002)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["contentType", "fileSize"],
                properties: {
                  contentType: { type: "string", example: "image/jpeg" },
                  fileSize: { type: "integer", maximum: 5242880 },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Signed URL issued",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["uploadUrl", "objectPath", "expiresAt"],
                  properties: {
                    uploadUrl: { type: "string", format: "uri" },
                    objectPath: { type: "string" },
                    expiresAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
          "400": { description: "Invalid content type or size" },
        },
      },
    },
    "/products": {
      post: {
        summary: "Create product (CTR-003)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "artistName", "coverArtPath"],
                properties: {
                  name: { type: "string", maxLength: 120 },
                  artistName: { type: "string", maxLength: 120 },
                  coverArtPath: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Created (status=pending for customer; published for admin)",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Product" } } },
          },
        },
      },
      get: {
        summary: "List products (CTR-004)",
        parameters: [
          {
            name: "status",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["pending", "published", "rejected"] },
            description: "Admin-only filter; ignored for customers (always 'published')",
          },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
    "/products/{id}": {
      get: { summary: "Read product (CTR-005)", responses: { "200": { description: "OK" } } },
      patch: { summary: "Update product (CTR-006)", responses: { "200": { description: "OK" } } },
      delete: {
        summary: "Delete product (CTR-007)",
        responses: { "204": { description: "No content" } },
      },
    },
    "/products/{id}/approve": {
      post: { summary: "Admin approve (CTR-008)", responses: { "200": { description: "OK" } } },
    },
    "/products/{id}/reject": {
      post: { summary: "Admin reject (CTR-009)", responses: { "200": { description: "OK" } } },
    },
  },
} as const;
