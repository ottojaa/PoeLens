# Production image for the PoeLens backend. The same file builds the web app (the `builder` stage) so that
# scripts/deploy.sh can copy its static files out for nginx.

# ─── Stage 1: builder ────────────────────────────────────────────────────────
# Compiles @poelens/shared, the backend and the web app. A Debian (glibc) base, like the runtime, so native modules
# built here still load there and node_modules can be copied across stages.
FROM node:22 AS builder
WORKDIR /app

# Yarn is pinned in .yarn/releases and run through node, so the build never depends on corepack.
# Manifests first, so the dependency layer is cached until a package.json or the lockfile changes.
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/ ./.yarn/
COPY apps/backend/package.json ./apps/backend/
COPY apps/web/package.json ./apps/web/
COPY libs/shared/package.json ./libs/shared/

RUN node .yarn/releases/yarn-4.17.1.cjs install --immutable

COPY . .

# Where the browser reaches the API. A production web build refuses to run without it.
ARG VITE_API_URL=https://api.poelens.com
ENV VITE_API_URL=$VITE_API_URL
ENV CI=true
ENV NX_DAEMON=false
RUN node_modules/.bin/nx run-many -t build --configuration=production

# Keep only the backend's production dependencies (plus the @poelens/shared workspace link). The result is what the
# runtime stage copies; the web app's build tools stay behind in this stage.
RUN node .yarn/releases/yarn-4.17.1.cjs workspaces focus @poelens/backend --production


# ─── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# node_modules/@poelens/shared is a symlink to ../../libs/shared, so libs/shared (with its built dist) has to sit at
# the same relative path. Nothing is installed here.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/libs/shared ./libs/shared
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/package.json ./package.json

USER node
EXPOSE 3100

# One-off commands run from this image (see scripts/deploy.sh):
#   node apps/backend/dist/apps/backend/src/db/migrate.js
CMD ["node", "apps/backend/dist/main.js"]
