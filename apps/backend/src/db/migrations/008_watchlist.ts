import { type Kysely, sql } from 'kysely';

/**
 * Each user's watched items. An entry is an item, not an item in a league: the game comes from `items`, and the
 * watchlist page prices the list in whichever league is selected. The primary key's leading column serves "this
 * user's list", so there is no other index.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`
        CREATE TABLE IF NOT EXISTS watchlist_items (
            user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            item_id integer NOT NULL REFERENCES items (id) ON DELETE CASCADE,
            created_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (user_id, item_id)
        )
    `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`DROP TABLE IF EXISTS watchlist_items`.execute(db);
}
