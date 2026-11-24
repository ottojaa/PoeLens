import { ConflictError, NotFoundError, type ResetLinkResponse } from '@poelens/shared';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';
import { deleteApiTokens } from '../api-tokens/index.js';
import { invalidLinkError } from './link-errors.js';
import { hashPassword } from './passwords.js';
import { deleteRefreshTokens } from './sessions.js';
import { expiresInDays, generateToken, hashToken, RESET_TTL_DAYS } from './tokens.js';

/**
 * An admin's one-time link for a user who lost their password. A user has at most one open link: a new one replaces it.
 * A deactivated user gets none, since redeeming it would be refused: reactivate them first.
 */
export function issueResetLink(db: Kysely<Database>, input: { userId: string; createdBy: string }): Promise<ResetLinkResponse> {
    return db.transaction().execute(async (trx) => {
        const user = await trx.selectFrom('users').select(['id', 'is_active']).where('id', '=', input.userId).executeTakeFirst();

        if (!user) throw new NotFoundError('User', input.userId);

        if (!user.is_active) throw new ConflictError('Reactivate this person before issuing a reset link');

        await trx.deleteFrom('password_resets').where('user_id', '=', input.userId).where('used_at', 'is', null).execute();

        const { token, hash } = generateToken();
        const expiresAt = expiresInDays(RESET_TTL_DAYS);

        await trx
            .insertInto('password_resets')
            .values({ token_hash: hash, user_id: input.userId, created_by: input.createdBy, expires_at: expiresAt })
            .execute();

        return { token, expiresAt: expiresAt.toISOString() };
    });
}

/**
 * Sets the new password and ends every session and API token of the user, in the same transaction as the conditional consume of the
 * link: a replayed link finds nothing, and a failure anywhere leaves the link usable. API tokens end with the sessions: a
 * reset is what an admin does for an account that may be compromised. The user row is updated before the tokens are
 * deleted, for the reason given in startSession. Does not sign the user in.
 */
export async function redeemReset(db: Kysely<Database>, input: { token: string; password: string }): Promise<void> {
    const passwordHash = await hashPassword(input.password);

    await db.transaction().execute(async (trx) => {
        const reset = await trx
            .updateTable('password_resets')
            .set({ used_at: new Date() })
            .where('token_hash', '=', hashToken(input.token))
            .where('used_at', 'is', null)
            .where('expires_at', '>', sql<Date>`now()`)
            .returning('user_id')
            .executeTakeFirst();

        if (!reset) throw invalidLinkError('reset');

        const user = await trx
            .updateTable('users')
            .set({ password_hash: passwordHash, updated_at: new Date() })
            .where('id', '=', reset.user_id)
            .where('is_active', '=', true)
            .returning('id')
            .executeTakeFirst();

        // A deactivated account cannot be reset: the throw rolls the consume back.
        if (!user) throw invalidLinkError('reset');

        await deleteRefreshTokens(trx, user.id);
        await deleteApiTokens(trx, user.id);
    });
}
