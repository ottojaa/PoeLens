---
name: shared-conventions
description: Shared library conventions for `@poelens/shared` — Zod schemas as the single source of truth for API contracts, code that must run in BOTH Node and browser, `Schema` suffix naming, `.js` ESM import extensions, barrel exports, and building it before tests. Load before writing or reviewing any code under `libs/shared`.
---

# Shared Library

TypeScript library of Zod schemas and types used by both backend and web app. ESM (`"type": "module"`), consumed from its built `dist/`: after changing it, run `nx run @poelens/shared:build` before the backend typecheck or tests, or they fail with "X is not a function". (`nx test` and `nx serve` build it first.)

## Purpose

- Define API contracts once, share everywhere
- Runtime validation = compile-time types
- Domain primitives: `GameSchema` (`poe1` | `poe2`), the legal notices (`GGG_DISCLAIMER`, `POE_NINJA_ATTRIBUTION`), the `AppError` family

## Environment Constraint

All code must work in both Node.js and browser: no `fs`, `path` or `process`, no `window`, `document` or `localStorage`, no environment-specific dependencies.

## Structure

```
src/
  api/
    contracts.ts     # Re-exports all API schemas
    schemas/         # one file per area (health.ts, ...)
  domain/            # game.ts, legal.ts, domain types
  errors.ts          # AppError family
  index.ts           # Main exports
```

## Schema Pattern

```typescript
import { z } from 'zod';
import { GameSchema } from '../../domain/game.js';

export const LeagueSchema = z.object({
    game: GameSchema,
    name: z.string(),
    started_at: z.string().datetime(),
});

export type League = z.infer<typeof LeagueSchema>;
```

## Conventions

- All schemas end with `Schema`; inferred types use the name without the suffix
- Anything game-specific carries a `game` field
- Use `.js` extensions in relative imports (ESM)
- Export everything from `index.ts`; barrel re-exports (`contracts.ts`, `index.ts`) are the intended pattern in this library
- Every schema or helper gets a test beside it (`*.test.ts`)
