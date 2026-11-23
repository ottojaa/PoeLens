import { type Kysely, sql } from 'kysely';

/**
 * Accounts for an invite-only app. Every secret token (refresh, invite, reset) is stored as its sha256: a leaked
 * database yields no usable token.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`
        CREATE TABLE IF NOT EXISTS users (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            email text NOT NULL,
            display_name text NOT NULL,
            password_hash text NOT NULL,
            role text NOT NULL CHECK (role IN ('admin', 'member')),
            is_active boolean NOT NULL DEFAULT true,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            last_login_at timestamptz
        )
    `.execute(db);
    // Case-insensitive: "A@b.co" and "a@b.co" are one account.
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (lower(email))`.execute(db);

    // A sign-in provider's account linked to a user (empty until "Sign in with Path of Exile": subject is GGG's profile uuid).
    await sql`
        CREATE TABLE IF NOT EXISTS user_identities (
            provider text NOT NULL,
            subject text NOT NULL,
            user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            created_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (provider, subject)
        )
    `.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS user_identities_user_idx ON user_identities (user_id)`.execute(db);

    await sql`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            token_hash text NOT NULL UNIQUE,
            expires_at timestamptz NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        )
    `.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS refresh_tokens_user_idx ON refresh_tokens (user_id)`.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS refresh_tokens_expires_idx ON refresh_tokens (expires_at)`.execute(db);

    // created_by is null for the invite the bootstrap command issues.
    await sql`
        CREATE TABLE IF NOT EXISTS invites (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            token_hash text NOT NULL UNIQUE,
            role text NOT NULL CHECK (role IN ('admin', 'member')),
            created_by uuid REFERENCES users (id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            expires_at timestamptz NOT NULL,
            used_at timestamptz,
            used_by uuid REFERENCES users (id) ON DELETE SET NULL,
            revoked_at timestamptz
        )
    `.execute(db);

    await sql`
        CREATE TABLE IF NOT EXISTS password_resets (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            token_hash text NOT NULL UNIQUE,
            user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
            created_by uuid REFERENCES users (id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            expires_at timestamptz NOT NULL,
            used_at timestamptz
        )
    `.execute(db);
    await sql`CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets (user_id)`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`DROP TABLE IF EXISTS password_resets`.execute(db);
    await sql`DROP TABLE IF EXISTS invites`.execute(db);
    await sql`DROP TABLE IF EXISTS refresh_tokens`.execute(db);
    await sql`DROP TABLE IF EXISTS user_identities`.execute(db);
    await sql`DROP TABLE IF EXISTS users`.execute(db);
}
