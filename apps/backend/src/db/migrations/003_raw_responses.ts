import { type Kysely, sql } from 'kysely';

/**
 * Every response a collector accepts, kept forever so a parser bug can be fixed and the data re-parsed. A plain table, not
 * a hypertable: the bodies are already gzipped, so compression would gain nothing.
 *
 * The next request's If-None-Match is the ETag of the newest row for that request, so the ETag can never run ahead of
 * the data that is stored.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`
        CREATE TABLE IF NOT EXISTS raw_responses (
            id serial PRIMARY KEY,
            source text NOT NULL,
            game text NOT NULL,
            kind text NOT NULL,
            league text NOT NULL DEFAULT '',
            category text NOT NULL DEFAULT '',
            url text NOT NULL,
            fetched_at timestamptz NOT NULL,
            status integer NOT NULL,
            etag text,
            sha256 text NOT NULL,
            body bytea NOT NULL,
            parser_version integer,
            parse_error text
        )
    `.execute(db);
    // One request is (source, game, kind, league, category). This index serves the ETag lookup and "newest snapshot".
    await sql`
        CREATE INDEX IF NOT EXISTS raw_responses_request_idx
        ON raw_responses (source, game, kind, league, category, fetched_at DESC)
    `.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS raw_responses_fetched_at_idx ON raw_responses (fetched_at)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`DROP TABLE IF EXISTS raw_responses`.execute(db);
}
