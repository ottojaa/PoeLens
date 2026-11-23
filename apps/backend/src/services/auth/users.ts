import { ForbiddenError, NotFoundError, type User } from '@poelens/shared';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';
import { verifyPassword } from './passwords.js';
import { deleteRefreshTokens, startSession, type StartedSession, type UserRow } from './sessions.js';

export function toUser(row: UserRow): User {
    return {
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        role: row.role,
        isActive: row.is_active,
        createdAt: row.created_at.toISOString(),
        lastLoginAt: row.last_login_at?.toISOString() ?? null,
    };
}

export function findUserById(db: Kysely<Database>, id: string): Promise<UserRow | undefined> {
    return db.selectFrom('users').selectAll().where('id', '=', id).executeTakeFirst();
}

export function listUsers(db: Kysely<Database>): Promise<UserRow[]> {
    return db.selectFrom('users').selectAll().orderBy('created_at').execute();
}

/**
 * Email and password. Every failure (unknown email, inactive account, wrong password) returns null, and the unknown and
 * inactive cases still run a bcrypt comparison, so neither the answer nor its timing says whether the account exists.
 */
export async function login(db: Kysely<Database>, email: string, password: string): Promise<StartedSession | null> {
    const user = await db
        .selectFrom('users')
        .selectAll()
        .where(sql<string>`lower(email)`, '=', email.toLowerCase())
        .executeTakeFirst();
    const usable = user?.is_active ? user : undefined;
    const matches = await verifyPassword(password, usable?.password_hash ?? null);

    if (!usable || !matches) return null;

    return startSession(db, usable.id, usable.password_hash);
}

/** Deactivation ends every session. An admin cannot deactivate themselves, so the only admin cannot lock the app out. */
export function deactivateUser(db: Kysely<Database>, actorId: string, userId: string): Promise<UserRow> {
    if (actorId === userId) throw new ForbiddenError('You cannot deactivate yourself');

    return db.transaction().execute(async (trx) => {
        // Updating the row first takes its lock: see startSession.
        const user = await trx
            .updateTable('users')
            .set({ is_active: false, updated_at: new Date() })
            .where('id', '=', userId)
            .returningAll()
            .executeTakeFirst();

        if (!user) throw new NotFoundError('User', userId);

        await deleteRefreshTokens(trx, userId);

        return user;
    });
}

export async function reactivateUser(db: Kysely<Database>, userId: string): Promise<UserRow> {
    const user = await db.updateTable('users').set({ is_active: true, updated_at: new Date() }).where('id', '=', userId).returningAll().executeTakeFirst();

    if (!user) throw new NotFoundError('User', userId);

    return user;
}
