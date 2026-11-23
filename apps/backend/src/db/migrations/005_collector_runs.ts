import { type Kysely, sql } from 'kysely';

/** One row per collection cycle of a data source: what /health reports and what a stuck collector leaves behind. */
export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`
        CREATE TABLE IF NOT EXISTS collector_runs (
            id serial PRIMARY KEY,
            source text NOT NULL,
            game text NOT NULL,
            started_at timestamptz NOT NULL,
            finished_at timestamptz,
            status text NOT NULL,
            error text,
            requests integer NOT NULL DEFAULT 0,
            unchanged integer NOT NULL DEFAULT 0,
            stored integer NOT NULL DEFAULT 0,
            price_rows integer NOT NULL DEFAULT 0,
            parse_errors integer NOT NULL DEFAULT 0,
            fetch_errors integer NOT NULL DEFAULT 0
        )
    `.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS collector_runs_started_idx ON collector_runs (source, game, started_at DESC)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`DROP TABLE IF EXISTS collector_runs`.execute(db);
}
