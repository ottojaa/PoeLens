import { type Kysely, sql } from 'kysely';

/**
 * Personal API tokens for MCP clients. A token is stored only as the sha256 of its secret (like refresh tokens), and
 * revoking one deletes its row, so a lookup that finds a row is a live token. Deleting a user deletes their tokens.
 * `token_hash` is unique, which also serves the one lookup the token check does; `user_id` serves "this user's tokens".
 */
export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`
        CREATE TABLE IF NOT EXISTS api_tokens (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            name text NOT NULL,
            token_hash text NOT NULL UNIQUE,
            prefix text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            last_used_at timestamptz
        )
    `.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS api_tokens_user_id_idx ON api_tokens (user_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`DROP TABLE IF EXISTS api_tokens`.execute(db);
}
