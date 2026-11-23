# PoeLens

A self-hosted companion app for Path of Exile 2 (and later Path of Exile 1). It records economy prices over time, lets you watch the items you care about, and answers price questions over MCP.

**Status:** the workspace is set up and the API, web app and desktop shell start. The price collector and accounts are next; see [ROADMAP.md](ROADMAP.md).

Planned for the first version: hourly price history from [poe.ninja](https://poe.ninja), an economy view you can configure, search across everything, per-item history charts, a watchlist, an MCP server, and invite-only accounts. It ships as a web app, an Electron desktop app and an Android app.

## Development

An Nx + Yarn 4 monorepo: `apps/backend` (Fastify API), `apps/web` (React web app and the Electron shell), `libs/shared` (Zod contracts). You need Node 20.19 or newer and Docker for the database. Yarn is pinned inside the repo, so it needs no installation: use `node .yarn/releases/yarn-4.17.1.cjs` wherever you would type `yarn`.

```sh
node .yarn/releases/yarn-4.17.1.cjs install
cp .env.example .env                       # optional: every value is also the default outside production
docker compose up -d postgres              # TimescaleDB on 127.0.0.1:5433
npx nx run @poelens/backend:migrate      # apply the migrations
npx nx serve @poelens/backend              # API on http://localhost:3100, docs at /docs
npx nx serve @poelens/web                  # web app on http://localhost:4300
npx nx run @poelens/web:serve:electron     # web dev server plus the desktop shell around it
```

The API answers `/health` with "degraded" while the database is not running, so you can start it without Docker.

Checks:

```sh
npx nx run-many -t lint typecheck          # lint and typecheck
npx nx format:check --all                  # formatting
npx nx run-many -t test                    # tests (builds @poelens/shared and the backend first)
```

See [CLAUDE.md](CLAUDE.md) for the conventions.

---

This product isn't affiliated with or endorsed by Grinding Gear Games in any way.
