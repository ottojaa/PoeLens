import { type Kysely, sql } from 'kysely';

/**
 * TimescaleDB holds the price history (hypertables, compression, continuous aggregates). The timescale image preloads
 * the library, so creating the extension is all that is needed.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`CREATE EXTENSION IF NOT EXISTS timescaledb`.execute(db);
}

// Dropping the extension drops every hypertable that depends on it, so this is only safe while no table uses it yet.
// Later migrations must never be undone by dropping the extension.
export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`DROP EXTENSION IF EXISTS timescaledb`.execute(db);
}
