import { type Kysely, sql } from 'kysely';

const COMPRESS_AFTER = '14 days';

/**
 * The price history: one row per item per snapshot, in all three units, each converted with the rates of the response
 * it came from so the history stays correct when rates move. `time` is when the snapshot was fetched.
 *
 * The unique key includes `time` (a hypertable requires it) and makes a re-parse an idempotent upsert.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`
        CREATE TABLE IF NOT EXISTS prices (
            time timestamptz NOT NULL,
            game text NOT NULL,
            league text NOT NULL,
            item_id integer NOT NULL REFERENCES items (id),
            source text NOT NULL,
            divine double precision NOT NULL,
            exalted double precision NOT NULL,
            chaos double precision NOT NULL,
            listings integer,
            volume double precision,
            low_confidence boolean NOT NULL DEFAULT false,
            raw_id integer NOT NULL REFERENCES raw_responses (id),
            PRIMARY KEY (game, league, item_id, source, time)
        )
    `.execute(db);
    await sql`SELECT create_hypertable('prices', by_range('time'), if_not_exists => TRUE)`.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS prices_raw_idx ON prices (raw_id)`.execute(db);

    // Compressed chunks are expensive to rewrite: a re-parse of data older than this is slower, but still correct.
    await sql`
        ALTER TABLE prices SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'game, league, item_id',
            timescaledb.compress_orderby = 'time DESC'
        )
    `.execute(db);
    await sql.raw(`SELECT add_compression_policy('prices', INTERVAL '${COMPRESS_AFTER}', if_not_exists => TRUE)`).execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`SELECT remove_compression_policy('prices', if_exists => TRUE)`.execute(db);
    await sql`DROP TABLE IF EXISTS prices`.execute(db);
}
