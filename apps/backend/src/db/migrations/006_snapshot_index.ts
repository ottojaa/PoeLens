import { type Kysely, sql } from 'kysely';

/**
 * "The newest snapshot of each category in a league" filters raw_responses on game, league and category, without source or
 * kind, so the request index (which starts with source) cannot serve it and Postgres 17 has no skip scan. Only responses
 * that parsed cleanly are snapshots, which keeps this index small.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`
        CREATE INDEX IF NOT EXISTS raw_responses_snapshot_idx
        ON raw_responses (game, league, category, fetched_at DESC, id DESC)
        WHERE parser_version IS NOT NULL AND parse_error IS NULL
    `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`DROP INDEX IF EXISTS raw_responses_snapshot_idx`.execute(db);
}
