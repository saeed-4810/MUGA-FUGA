# syntax=docker/dockerfile:1.7
# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Copy workspace topology
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/
# Frontend package.json is required for pnpm to resolve the workspace, even though
# we don't build the frontend in this image.
COPY apps/frontend/package.json apps/frontend/

RUN pnpm install --frozen-lockfile --prefer-offline

# Copy backend source and build
COPY apps/backend ./apps/backend
RUN pnpm --filter @muga/backend build \
    && pnpm --filter @muga/backend deploy --prod /out

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080

# Copy deployed prod-only deps + compiled source
COPY --from=builder /out/node_modules ./node_modules
COPY --from=builder /repo/apps/backend/dist ./dist
COPY --from=builder /repo/apps/backend/package.json ./package.json

# Run as non-root
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "dist/index.js"]
