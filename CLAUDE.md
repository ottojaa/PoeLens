# PoeLens

Self-hosted "everything Path of Exile" companion: a collector stores poe.ninja economy prices over time, and the web and desktop apps show them, with search, history charts and a watchlist. Path of Exile 2 first, Path of Exile 1 later. Nx + Yarn 4 (Berry) monorepo, TypeScript throughout, Node 20.19+. The repo is public; user-facing text spells the name "PoeLens", the npm scope is `@poelens`.

## Monorepo Structure

- `apps/backend` — Fastify API server (esbuild, CJS, unbundled)
- `apps/web` — React 19 web app, plus `electron/`: the desktop shell, a window onto the hosted web app
- `libs/shared` — Zod schemas and TypeScript types shared between backend and web (`@poelens/shared`, ESM)

## Tech Stack

| Layer           | Technology                                        |
| --------------- | ------------------------------------------------- |
| Backend Runtime | Node.js + Fastify 5                               |
| Database        | PostgreSQL + TimescaleDB, Kysely                  |
| Validation      | Zod                                               |
| Web UI          | React + TanStack Router/Query + Tailwind + shadcn |
| Desktop         | Electron (loads the hosted web app)               |

## Dev Ports

API `3100`, web `4300` (offset from reverie's, so both stacks run at once). Postgres `127.0.0.1:5433` from `docker compose up -d postgres` (user, password and database `poelens`). `/docs` serves the API's Swagger UI.

## Key Conventions

- Run tasks through Nx: `nx serve @poelens/backend`, `nx build @poelens/web`, `nx run-many -t lint`.
- There is no `yarn` on PATH: run Yarn as `node .yarn/releases/yarn-4.17.1.cjs <args>` (pinned in `.yarnrc.yml`, which also sets a 14-day package age gate).
- API contracts are defined once as Zod schemas in `libs/shared` and used by both backend validation and web client validation.
- Anything game-specific carries a `game` value (`poe1` | `poe2`, `GameSchema`), and so does anything per league.
- Use `.js` extensions in relative imports (ESM in `libs/shared` needs them; the backend follows).
- Never use the `any` type unless absolutely necessary.
- Data sources: only poe.ninja's documented economy endpoints and GGG's documented APIs. Clients never call poe.ninja directly; only the backend does. Tests never call the real APIs, they use recorded fixtures.
- Keep the GGG notice and the poe.ninja credit (`libs/shared/src/domain/legal.ts`) in the web footer.

## Commands

- `nx run-many -t lint typecheck` — lint and typecheck everything. `nx format:write --all` / `nx format:check --all` — Prettier.
- **Build `@poelens/shared` before tests**: the backend imports its built `dist/`, so a stale build fails with "X is not a function". The `test` target depends on `^build`, so `nx test` does this itself; running `vitest` by hand does not.
- Backend tests boot the **built** app (`apps/backend/dist`), so the backend `test` target depends on `build` too.
- `nx migrate @poelens/backend` applies migrations, `nx run @poelens/backend:migrate:down` rolls back one. In production the build also emits the runner: `node dist/apps/backend/src/db/migrate.js` (the esbuild output is nested under `dist/apps/backend/src`).
- `nx serve @poelens/backend` answers `/health` with "degraded" when Postgres is not running; nothing needs a `.env` on a clean checkout.
- A production web build needs `VITE_API_URL` (the API's base URL; empty means same-origin): `VITE_API_URL=https://api.example.com nx build @poelens/web`. Forgetting it fails the build instead of shipping a bundle that calls the wrong host.
- `nx run @poelens/web:serve:electron` runs the Vite dev server and the desktop shell. `package:mac|win|linux` build installers.
- Only run tests/typecheck/lint when it's relevant to the change or the user asks — don't run them reflexively after every edit.

## Production safety

- **No test files under `apps/backend/src/app/routes` or `app/plugins`.** Production autoloads every file in both folders and has no dev dependencies, so a test file there crash-loops the server. Tests live next to the code elsewhere (`src/app/*.test.ts`, `src/config/`, ...). `routes-autoload.test.ts` guards this.
- Electron packaging ships only `dist-electron/**/*`, and electron-builder bundles a package's `dependencies`. All of `apps/web`'s renderer dependencies therefore live in its `devDependencies` (Vite bundles them for the hosted app). Do not add runtime `dependencies` there.
- The desktop window may only show the hosted app's origin (`electron/navigation.mts`); other http(s) links open in the default browser.

## Code Style

- **Prefer early returns.** Exit early when preconditions fail; keep the primary path unindented.
- **Avoid nested conditionals.** Flatten with early returns or named helpers; inner functions are fine when they don't warrant extraction.
- **Prefer Immer over deep object spreads** for nested updates; shallow spreads only for simple, one-level updates.

## Coding Conventions

- Treat objects as **immutable**; produce new values rather than mutating in place.
- **Static error-message text**, with any dynamic part after a colon (e.g. `throw new Error('Failed to load league: ' + id)`) — keeps errors groupable in logging.
- Keep functions under ~40 lines and files under ~300 lines; extract when they grow past that.
- **Naming**: `fetchX` (remote/async fetch), `loadX` (load into memory/state), `isX`/`hasX` (booleans), `assertX` (throws on failure), `toX` (pure converters).
- Mark follow-ups with `// TODO <initials>:` and actionable text.
- Prefer `function` declarations for top-level functions; arrow functions for inline callbacks and React components as idiomatic.
- Comments explain the code to a stranger; they do not refer to plans, tickets or runs.
- Don't refactor existing code to match these conventions unless asked — follow them for new code and keep local consistency in files you touch.

Area-specific conventions live in on-demand skills (see below) — those take precedence within their area.

## Memories Workflow

When you discover a non-obvious gotcha or make a mistake worth not repeating, in addition to fixing it:

- Add a **code comment** for knowledge specific to a single line/function.
- Add an entry to **`.claude/memories/index.md`** for project-level, architectural, or cross-file knowledge.

This memories file is tracked in git (the shared project layer, so background runs building from `main` see it). The repo is public: keep entries about the code, not about people or private setup.

## Skills (area conventions, loaded on demand)

`.claude/skills/`: `backend-conventions`, `database-conventions`, `web-conventions`, `shared-conventions`.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.

<!-- nx configuration end-->
