---
name: backend-conventions
description: Backend conventions for the Fastify API — autoloaded plugins and routes, route/service layering, Zod contracts from @poelens/shared, Kysely usage, env, the /health probe, error handling and where tests live. Load before writing or reviewing any code under `apps/backend`, or when asked about backend architecture.
---

# Backend Architecture

Fastify 5 API. `app/app.ts` autoloads `app/plugins/` (alphabetically) and then `app/routes/`; `main.ts` registers that app plugin, listens and handles shutdown. Built with esbuild to CJS, unbundled (`apps/backend/dist/apps/backend/src/...`).

## Route Pattern

Routes import schemas from `@poelens/shared` and use Zod for validation (the Zod type provider is registered in `plugins/zod.ts`):

```typescript
import { SomeRequestSchema, SomeResponseSchema } from '@poelens/shared';

export default async function (fastify: FastifyInstance) {
    fastify.post<{ Body: z.infer<typeof SomeRequestSchema> }>(
        '/endpoint',
        {
            schema: {
                body: SomeRequestSchema,
                response: { 200: SomeResponseSchema },
            },
        },
        async (request) => {
            // Handler calls a service, never contains business logic
            return someService.doThing(request.body);
        },
    );
}
```

Route files end in `.route.ts`. Routes are unprefixed (`/health`, `/docs`).

## Layer Responsibilities

- **Routes** (`app/routes/`): HTTP validation, call services, return responses
- **Plugins** (`app/plugins/`): cors, helmet, rate-limit, sensible, error handler, Zod compilers, Swagger
- **Services** (`services/`): business logic, database operations, transaction management
- **Collectors** (a data source each, e.g. poe.ninja): separate, pluggable modules that write snapshots; the web and desktop clients never call a data source themselves

## Tests do not go in `app/routes` or `app/plugins`

Production autoloads every file in both folders and has no dev dependencies, so a test file there crash-loops the server (the autoload `ignorePattern` is a second line of defence, not the rule). Put tests beside other code (`src/app/*.test.ts`, `src/config/*.test.ts`). `src/testing/build-app.ts` boots the **built** app on a bare Fastify for `inject`: autoload imports files natively, which cannot load `.ts`, so the `test` target depends on `build`. Set `process.env.DATABASE_URL` before the first `buildTestApp()` call, because `config/env.ts` reads the environment when first loaded. Tests never call real external APIs: use recorded fixtures.

## Env

`config/env-schema.ts` holds the pure `parseEnv(source)` (tested in `env.test.ts`); `config/env.ts` loads the `.env` found upward from the file (or `ENV_FILE`), validates and exits on error. `DATABASE_URL` defaults to the dev compose database outside production and is required in production. Add every new variable to `.env.example`.

## Database (Kysely)

- Type-safe queries via the `db` instance from `db/kysely.ts`; migrations in `db/migrations/`; schema types in `db/schema.ts`. See the database-conventions skill.
- The pool behind `db` (`db/pool.ts`) has an error listener and no query timeout: bulk writes and chart queries may run long.
- `/health` uses its **own** one-connection pool (`db/health-probe.ts`) with a 1.5 s connect and query timeout, so it answers "degraded" within about 2 s even when Postgres refuses connections or accepts them and never answers, and a busy main pool can never delay it. Every pg `Pool` needs an `error` listener, or an idle-client error crashes the process.

## Error Handling

- Use `@poelens/shared`'s `AppError` family (`NotFoundError`, ...); `plugins/error-handler.ts` maps them to the wire format and hides the message of unexpected errors.
- Never leak raw database errors to clients
- Wrap external service errors at the service boundary
- Error messages are static text, with the dynamic part after a colon
