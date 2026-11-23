import { type Kysely, sql } from 'kysely';

/**
 * The catalogue: leagues, items, and the keys data sources know them by. Plain tables (small, read-mostly). pg_trgm backs
 * the typo-tolerant item search.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`.execute(db);

    await sql`
        CREATE TABLE IF NOT EXISTS leagues (
            game text NOT NULL,
            name text NOT NULL,
            hardcore boolean NOT NULL,
            current boolean NOT NULL DEFAULT false,
            first_seen timestamptz NOT NULL,
            last_seen timestamptz NOT NULL,
            PRIMARY KEY (game, name)
        )
    `.execute(db);
    // "current" resolves to one league per game and hardcore flag: the current challenge league and its hardcore version.
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS leagues_current_idx ON leagues (game, hardcore) WHERE current`.execute(db);

    await sql`
        CREATE TABLE IF NOT EXISTS items (
            id serial PRIMARY KEY,
            game text NOT NULL,
            name text NOT NULL,
            base_type text,
            category text NOT NULL,
            icon text
        )
    `.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS items_game_category_idx ON items (game, category)`.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS items_name_trgm_idx ON items USING gin (name gin_trgm_ops)`.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS items_base_type_trgm_idx ON items USING gin (base_type gin_trgm_ops)`.execute(db);

    // The seam a second data source (or a better matcher) plugs into: (source, game, external key) points at one item.
    await sql`
        CREATE TABLE IF NOT EXISTS item_keys (
            source text NOT NULL,
            game text NOT NULL,
            external_key text NOT NULL,
            item_id integer NOT NULL REFERENCES items (id) ON DELETE CASCADE,
            PRIMARY KEY (source, game, external_key)
        )
    `.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS item_keys_item_idx ON item_keys (item_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`DROP TABLE IF EXISTS item_keys`.execute(db);
    await sql`DROP TABLE IF EXISTS items`.execute(db);
    await sql`DROP TABLE IF EXISTS leagues`.execute(db);
    await sql`DROP EXTENSION IF EXISTS pg_trgm`.execute(db);
}
