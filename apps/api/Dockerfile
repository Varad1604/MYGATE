# SocietyOS API — production image
# Build from repo root:  docker build -f apps/api/Dockerfile -t societyos-api .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# --- deps: fetch the full workspace lockfile graph once ---
FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/api-client/package.json packages/api-client/
COPY packages/permissions/package.json packages/permissions/
RUN pnpm fetch

# --- build: compile TS + prisma client ---
FROM deps AS build
COPY . .
RUN pnpm install --frozen-lockfile --offline \
 && pnpm --filter @societyos/api exec prisma generate \
 && pnpm --filter @societyos/permissions build \
 && pnpm --filter @societyos/api-client build \
 && pnpm --filter @societyos/api build

# --- runtime: prod deps + dist only, no sources, no dev tooling ---
FROM node:22-alpine AS runtime
RUN corepack enable
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/apps/api/package.json ./
EXPOSE 4000
# Migrations run before boot; fail fast if the DB is unreachable.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
