---
name: database-conventions
description: PostgreSQL + TimescaleDB + Kysely conventions — schema types in db/schema.ts, type-safe queries and transactions, reversible and production-safe migrations, and TimescaleDB hypertables, time_bucket charts and compression for the price history. Load before writing or reviewing any code under `apps/backend/src/db`, or when working on queries or migrations.
---

# Database Layer (Kysely + PostgreSQL + TimescaleDB)

Dev database: `timescale/timescaledb:2.32.1-pg17` from `docker-compose.yml` on `127.0.0.1:5433` (user/password/database `poelens`). Migration 001 enables the `timescaledb` extension and nothing else.

## Schema Definition

Types in `db/schema.ts` match PostgreSQL tables exactly (`interface Database { table_name: TableRow }`, with Kysely's `Generated<>` for defaults). Tables that hold game data carry `game` (`poe1` | `poe2`) and, where it applies, the league.

## Query Patterns

```typescript
import { db } from './kysely.js';

const row = await db.selectFrom('items').where('id', '=', itemId).selectAll().executeTakeFirst();

await db.transaction().execute(async (trx) => {
    await trx.insertInto('snapshots').values(snapshot).execute();
    await trx.insertInto('prices').values(prices).execute();
});
```

## Migrations

Files in `db/migrations/` named `NNN_description.ts`, run by `nx run @poelens/backend:migrate` (`migrate:down` rolls back one). Rules:

- **Every migration is reversible**: `down` undoes `up` (drop what you created). A migration that cannot be undone (dropping a column with data) says so in a comment and is split into expand now, contract later.
- **Safe against production data**: assume the table has months of hourly snapshots. Add columns nullable or with a constant default, backfill in batches, then add the constraint. Create indexes on large tables with `CREATE INDEX CONCURRENTLY` (outside a transaction: set the migration up for it). Never rewrite a whole hypertable in one statement.
- Deploy order is new code first, migrate after, so code must never depend on a column that a pending migration adds, and a migration must not drop what the running code still reads.
- Use `IF NOT EXISTS` / `IF EXISTS` where the statement allows, so a half-applied run can be repeated.
- The migration runner has its own pool with no short timeouts.

## TimescaleDB

Time series (prices, snapshots) are hypertables; ordinary reference data (items, leagues) are plain tables.

- Create with `SELECT create_hypertable('prices', by_range('collected_at'))` right after the table, in the same migration. Choose the time column deliberately: it must be in every unique index and primary key of the table.
- Each row carries `game` and league, and indexes lead with the series key then time: `(game, league, item_id, collected_at DESC)`.
- Chart queries bucket in SQL, never in Node: `time_bucket('1 hour', collected_at)` (or `'1 day'`) with `GROUP BY` the bucket and the aggregate the chart needs (`last(price, collected_at)`, `avg`, `min`, `max`). Cap the range and the number of points a chart request can ask for.
- Compression: enable columnstore with `ALTER TABLE ... SET (timescaledb.compress, timescaledb.compress_segmentby = 'game, league, item_id')` and add a policy (`add_compression_policy('prices', INTERVAL '7 days')`). Compressed chunks are expensive to update: the collector only writes the newest chunk, and corrections go through a documented path, not ad hoc `UPDATE`s. Compression and retention policies are removed in the `down` of the migration that adds them.
- Writes are idempotent: the collector may run twice for the same hour, so inserts use `ON CONFLICT` on the series key plus time.
- `down` for a hypertable migration drops the table before the extension; migration 001's `down` drops the extension and fails while hypertables exist, on purpose.
