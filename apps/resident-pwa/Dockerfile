# SocietyOS resident PWA — static build behind nginx
# Build from repo root:  docker build -f apps/resident-pwa/Dockerfile -t societyos-resident .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/resident-pwa/package.json apps/resident-pwa/
RUN corepack pnpm fetch
COPY . .
RUN corepack pnpm install --frozen-lockfile --offline \
 && corepack pnpm --filter @societyos/resident-pwa build

FROM nginx:1.27-alpine AS runtime
COPY apps/resident-pwa/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/resident-pwa/dist /usr/share/nginx/html
EXPOSE 80
