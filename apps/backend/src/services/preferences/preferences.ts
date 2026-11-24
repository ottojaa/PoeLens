import { parsePreferences, UnauthorizedError, type Preferences } from '@poelens/shared';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';

/** The user's saved preferences. Values that are no longer valid are left out, never an error. */
export async function getPreferences(db: Kysely<Database>, userId: string): Promise<Preferences> {
    const row = await db.selectFrom('users').select('preferences').where('id', '=', userId).executeTakeFirst();

    if (!row) throw new UnauthorizedError('Sign in to continue', 'TOKEN_INVALID');

    return parsePreferences(row.preferences);
}

/**
 * Merges a validated partial update into the user's preferences and returns the result. One statement, so two updates
 * of different keys that run together both survive.
 *
 * This deliberately leaves `users.updated_at` alone: `createApiToken` reads a newer `updated_at` as "the user changed
 * since your session was issued" and refuses, so a theme click must not look like a password reset.
 */
export async function updatePreferences(db: Kysely<Database>, userId: string, patch: Preferences): Promise<Preferences> {
    const row = await db
        .updateTable('users')
        .set({ preferences: sql`preferences || ${JSON.stringify(patch)}::jsonb` })
        .where('id', '=', userId)
        .returning('preferences')
        .executeTakeFirst();

    if (!row) throw new UnauthorizedError('Sign in to continue', 'TOKEN_INVALID');

    return parsePreferences(row.preferences);
}
