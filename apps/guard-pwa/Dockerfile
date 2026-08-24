# SocietyOS resident PWA â€” static build behind nginx
# Build from repo root:  docker build -f apps/guard-pwa/Dockerfile -t societyos-resident .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/guard-pwa/package.json apps/guard-pwa/
RUN corepack pnpm fetch
COPY . .
RUN corepack pnpm install --frozen-lockfile --offline \
 && corepack pnpm --filter @societyos/guard-pwa build

FROM nginx:1.27-alpine AS runtime
COPY apps/guard-pwa/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/guard-pwa/dist /usr/share/nginx/html
EXPOSE 80
