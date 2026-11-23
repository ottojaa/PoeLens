import { sql, type Kysely, type Selectable } from 'kysely';
import type { Database, UsersTable } from '../../db/schema.js';
import { expiresInDays, generateToken, hashToken, REFRESH_TOKEN_TTL_DAYS } from './tokens.js';

export type UserRow = Selectable<UsersTable>;

export interface StartedSession {
    user: UserRow;
    /** The raw refresh token, for the cookie. Only its hash is stored. */
    refreshToken: string;
}

/** Stores a new refresh token for a user and returns the raw value. */
export async function issueRefreshToken(db: Kysely<Database>, userId: string): Promise<string> {
    const { token, hash } = generateToken();

    await db
        .insertInto('refresh_tokens')
        .values({ user_id: userId, token_hash: hash, expires_at: expiresInDays(REFRESH_TOKEN_TTL_DAYS) })
        .execute();

    return token;
}

/**
 * Signs in a user whose password hash was just checked. Updating the user row first takes its row lock, so a deactivation
 * or reset running at the same moment either commits before this (and no matching row is found: a reset changed the
 * hash, a deactivation the flag) or waits until this has stored its token (and then deletes it).
 */
export function startSession(db: Kysely<Database>, userId: string, verifiedHash: string): Promise<StartedSession | null> {
    return db.transaction().execute(async (trx) => {
        const user = await trx
            .updateTable('users')
            .set({ last_login_at: new Date() })
            .where('id', '=', userId)
            .where('is_active', '=', true)
            .where('password_hash', '=', verifiedHash)
            .returningAll()
            .executeTakeFirst();

        if (!user) return null;

        // Sessions nobody signed out of would otherwise pile up for good.
        await trx
            .deleteFrom('refresh_tokens')
            .where('user_id', '=', userId)
            .where('expires_at', '<=', sql<Date>`now()`)
            .execute();

        return { user, refreshToken: await issueRefreshToken(trx, userId) };
    });
}

/**
 * Spends a refresh token and issues its successor. The user row is locked first (`FOR SHARE`, and only if the user is
 * active), in the same order deactivation and reset take it (user row, then tokens), so the two cannot deadlock and
 * cannot slip between the delete and the insert and leave a live token behind. The delete is then the single point where
 * a token is spent: two requests with the same token cannot both get a row back.
 */
export function rotateRefreshToken(db: Kysely<Database>, token: string): Promise<StartedSession | null> {
    return db.transaction().execute(async (trx) => {
        const user = await trx
            .selectFrom('users')
            .selectAll()
            .where('id', 'in', trx.selectFrom('refresh_tokens').select('user_id').where('token_hash', '=', hashToken(token)))
            .where('is_active', '=', true)
            .forShare()
            .executeTakeFirst();

        if (!user) return null;

        const spent = await trx
            .deleteFrom('refresh_tokens')
            .where('token_hash', '=', hashToken(token))
            .where('expires_at', '>', sql<Date>`now()`)
            .returning('user_id')
            .executeTakeFirst();

        if (!spent) return null;

        return { user, refreshToken: await issueRefreshToken(trx, user.id) };
    });
}

/** Logout: the token stops working at once, not when it expires. A token that is not stored is not an error. */
export async function revokeRefreshToken(db: Kysely<Database>, token: string): Promise<void> {
    await db.deleteFrom('refresh_tokens').where('token_hash', '=', hashToken(token)).execute();
}

/** Every session of a user ends: deactivation and password resets. */
export async function deleteRefreshTokens(db: Kysely<Database>, userId: string): Promise<void> {
    await db.deleteFrom('refresh_tokens').where('user_id', '=', userId).execute();
}
