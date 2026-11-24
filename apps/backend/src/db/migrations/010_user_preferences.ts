import { type Kysely, sql } from 'kysely';

/**
 * What each user chose for the app (theme, light or dark mode, price unit), kept with the user so it follows them to
 * every device. One jsonb document: three small values read together with the user, so a table would only add joins.
 * Additive with a default, so the running backend (which never names the column) keeps working while this migration
 * runs, and every existing user reads as "nothing chosen yet".
 */
export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`ALTER TABLE users DROP COLUMN IF EXISTS preferences`.execute(db);
}
