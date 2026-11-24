import {
    API_TOKEN_PREFIX,
    API_TOKEN_PREFIX_LENGTH,
    ApiTokensFullError,
    MAX_API_TOKENS,
    UnauthorizedError,
    type ApiToken,
    type CreateApiTokenResponse,
} from '@poelens/shared';
import { sql, type Kysely, type Selectable } from 'kysely';
import type { ApiTokensTable, Database } from '../../db/schema.js';
import { generateToken, hashToken } from '../auth/tokens.js';
import type { Principal } from './principal.js';

/** How often a token's `last_used_at` is written at most: a busy token must not rewrite its row on every call. */
const LAST_USED_RESOLUTION = '1 minute';

type ApiTokenRow = Selectable<ApiTokensTable>;

function toApiToken(row: ApiTokenRow): ApiToken {
    return {
        id: row.id,
        name: row.name,
        prefix: row.prefix,
        createdAt: row.created_at.toISOString(),
        lastUsedAt: row.last_used_at?.toISOString() ?? null,
    };
}

/**
 * Makes a token for a user and returns its secret, the only time it exists in the clear. The user's row is locked for
 * the transaction (as `watchItem` does), so two creates at the limit cannot both count 9 and both insert, and a
 * deactivation or reset running at the same moment either commits first (and the user is refused here) or waits until
 * this token is stored (and then deletes it).
 *
 * `sessionIssuedAt` is when the caller's session token was issued (seconds since the epoch). A session issued before the
 * user's last change is refused: a stolen access token must not be able to mint a token that outlives the reset or
 * deactivation which was meant to end it. A redeemed reset is compared exactly (a session issued in the same second but
 * before the reset is refused); other changes to the user row compare in whole seconds.
 */
export function createApiToken(db: Kysely<Database>, input: { userId: string; name: string; sessionIssuedAt: number }): Promise<CreateApiTokenResponse> {
    return db.transaction().execute(async (trx) => {
        const user = await sql<{ is_active: boolean; changed_at: number; reset_since: boolean }>`
            SELECT is_active,
                   floor(extract(epoch FROM updated_at))::bigint AS changed_at,
                   EXISTS (SELECT 1 FROM password_resets WHERE user_id = ${input.userId} AND used_at >= to_timestamp(${input.sessionIssuedAt})) AS reset_since
              FROM users WHERE id = ${input.userId} FOR UPDATE`.execute(trx);
        const current = user.rows[0];

        if (!current?.is_active || current.reset_since || input.sessionIssuedAt < Number(current.changed_at)) {
            throw new UnauthorizedError('Sign in to continue', 'TOKEN_INVALID');
        }

        const { count } = await trx
            .selectFrom('api_tokens')
            .select((eb) => eb.fn.countAll<string>().as('count'))
            .where('user_id', '=', input.userId)
            .executeTakeFirstOrThrow();

        if (Number(count) >= MAX_API_TOKENS) throw new ApiTokensFullError(MAX_API_TOKENS);

        const secret = API_TOKEN_PREFIX + generateToken().token;
        const row = await trx
            .insertInto('api_tokens')
            .values({ user_id: input.userId, name: input.name, token_hash: hashToken(secret), prefix: secret.slice(0, API_TOKEN_PREFIX_LENGTH) })
            .returningAll()
            .executeTakeFirstOrThrow();

        return { token: toApiToken(row), secret };
    });
}

/** A user's tokens, newest first. */
export async function listApiTokens(db: Kysely<Database>, userId: string): Promise<ApiToken[]> {
    const rows = await db.selectFrom('api_tokens').selectAll().where('user_id', '=', userId).orderBy('created_at', 'desc').orderBy('id').execute();

    return rows.map(toApiToken);
}

/** Revoking deletes the row. Only the caller's own tokens can be touched; a token that is already gone is not an error. */
export async function revokeApiToken(db: Kysely<Database>, userId: string, tokenId: string): Promise<void> {
    await db.deleteFrom('api_tokens').where('id', '=', tokenId).where('user_id', '=', userId).execute();
}

/** Every token of a user ends: deactivation and password resets (next to `deleteRefreshTokens`). */
export async function deleteApiTokens(db: Kysely<Database>, userId: string): Promise<void> {
    await db.deleteFrom('api_tokens').where('user_id', '=', userId).execute();
}

/**
 * Who a token secret belongs to, or null. One statement per call: the token joined to an active user (nothing is cached,
 * so a revoked token or a deactivated user is refused on the next call), and `last_used_at` set when it is empty or
 * older than a minute.
 */
export async function authenticateApiToken(db: Kysely<Database>, secret: string): Promise<Principal | null> {
    const { rows } = await sql<{ id: string; user_id: string }>`
        WITH hit AS (
            SELECT t.id, t.user_id
              FROM api_tokens t
              JOIN users u ON u.id = t.user_id
             WHERE t.token_hash = ${hashToken(secret)} AND u.is_active
        ), touched AS (
            UPDATE api_tokens
               SET last_used_at = now()
             WHERE id IN (SELECT id FROM hit)
               AND (last_used_at IS NULL OR last_used_at < now() - ${LAST_USED_RESOLUTION}::interval)
        )
        SELECT id, user_id FROM hit`.execute(db);
    const hit = rows[0];

    return hit ? { userId: hit.user_id, via: 'api-token', credentialId: hit.id } : null;
}
