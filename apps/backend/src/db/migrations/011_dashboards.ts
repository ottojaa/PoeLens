import { type Kysely, sql } from 'kysely';

/**
 * Each user's dashboards (the tabs on the home page), one row per tab so tabs are edited independently. `panels` holds
 * the layout and blocks as JSON, validated by the API on every write; `revision` counts saves, so a save made from an
 * out-of-date copy can be refused. `(user_id, game, position)` serves "this user's tabs in order".
 */
export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`
        CREATE TABLE IF NOT EXISTS dashboards (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            game text NOT NULL,
            name text NOT NULL,
            position integer NOT NULL,
            panels jsonb NOT NULL,
            revision integer NOT NULL DEFAULT 1,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        )
    `.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS dashboards_user_game_position_idx ON dashboards (user_id, game, position)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`DROP TABLE IF EXISTS dashboards`.execute(db);
}
