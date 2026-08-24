# SocietyOS admin console — Next.js standalone image
# Build from repo root:  docker build -f apps/admin-web/Dockerfile -t societyos-admin .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/admin-web/package.json apps/admin-web/
COPY packages/api-client/package.json packages/api-client/
RUN pnpm fetch

FROM deps AS build
COPY . .
# Same-origin proxy target inside the compose network.
ENV API_PROXY_ORIGIN=http://api:4000
RUN pnpm install --frozen-lockfile --offline \
 && pnpm --filter @societyos/api-client build \
 && pnpm --filter @societyos/admin-web build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/apps/admin-web/.next/standalone ./
COPY --from=build /repo/apps/admin-web/.next/static ./apps/admin-web/.next/static
EXPOSE 3000
CMD ["node", "apps/admin-web/server.js"]
