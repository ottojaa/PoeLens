import { AppError, ConflictError, NotFoundError, type Invite, type InvitePreview, type Role } from '@poelens/shared';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';
import { invalidLinkError } from './link-errors.js';
import { hashPassword } from './passwords.js';
import { issueRefreshToken, type StartedSession } from './sessions.js';
import { expiresInDays, generateToken, hashToken, INVITE_TTL_DAYS } from './tokens.js';

export interface CreatedInvite {
    invite: Invite;
    /** The raw token, shown once: only its hash is stored. */
    token: string;
}

export interface RedeemInput {
    token: string;
    email: string;
    displayName: string;
    password: string;
}

const UNIQUE_VIOLATION = '23505';

function toInvite(row: { id: string; role: Role; created_at: Date; expires_at: Date }): Invite {
    return { id: row.id, role: row.role, createdAt: row.created_at.toISOString(), expiresAt: row.expires_at.toISOString() };
}

function isUniqueViolation(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === UNIQUE_VIOLATION;
}

/** `createdBy` is null for the invite the bootstrap command issues, before any user exists. */
export async function createInvite(db: Kysely<Database>, input: { role: Role; createdBy: string | null }): Promise<CreatedInvite> {
    const { token, hash } = generateToken();
    const row = await db
        .insertInto('invites')
        .values({ token_hash: hash, role: input.role, created_by: input.createdBy, expires_at: expiresInDays(INVITE_TTL_DAYS) })
        .returning(['id', 'role', 'created_at', 'expires_at'])
        .executeTakeFirstOrThrow();

    return { invite: toInvite(row), token };
}

/** Invites that can still be used, newest first. */
export async function listOpenInvites(db: Kysely<Database>): Promise<Invite[]> {
    const rows = await db
        .selectFrom('invites')
        .select(['id', 'role', 'created_at', 'expires_at'])
        .where('used_at', 'is', null)
        .where('revoked_at', 'is', null)
        .where('expires_at', '>', sql<Date>`now()`)
        .orderBy('created_at', 'desc')
        .execute();

    return rows.map(toInvite);
}

export async function revokeInvite(db: Kysely<Database>, id: string): Promise<void> {
    const revoked = await db
        .updateTable('invites')
        .set({ revoked_at: new Date() })
        .where('id', '=', id)
        .where('used_at', 'is', null)
        .where('revoked_at', 'is', null)
        .returning('id')
        .executeTakeFirst();

    if (!revoked) throw new NotFoundError('Invite', id);
}

/** What the invite page shows before anyone types a password. Null for every kind of dead link. */
export async function previewInvite(db: Kysely<Database>, token: string): Promise<InvitePreview | null> {
    const row = await db
        .selectFrom('invites')
        .select(['role', 'expires_at'])
        .where('token_hash', '=', hashToken(token))
        .where('used_at', 'is', null)
        .where('revoked_at', 'is', null)
        .where('expires_at', '>', sql<Date>`now()`)
        .executeTakeFirst();

    return row ? { role: row.role, expiresAt: row.expires_at.toISOString() } : null;
}

/**
 * Creates the account an invite is for and signs it in. The invite is consumed by a conditional UPDATE in the same
 * transaction as the user insert: of two simultaneous submits only one gets a row back, and an insert that fails (the
 * email is taken) rolls the consume back, so the link still works for a retry with another address.
 */
export async function redeemInvite(db: Kysely<Database>, input: RedeemInput): Promise<StartedSession> {
    // Before the transaction: a slow hash must not hold the invite row's lock.
    const passwordHash = await hashPassword(input.password);

    return db.transaction().execute(async (trx) => {
        const invite = await trx
            .updateTable('invites')
            .set({ used_at: new Date() })
            .where('token_hash', '=', hashToken(input.token))
            .where('used_at', 'is', null)
            .where('revoked_at', 'is', null)
            .where('expires_at', '>', sql<Date>`now()`)
            .returning(['id', 'role'])
            .executeTakeFirst();

        if (!invite) throw invalidLinkError('invite');

        const user = await trx
            .insertInto('users')
            .values({
                email: input.email.toLowerCase(),
                display_name: input.displayName,
                password_hash: passwordHash,
                role: invite.role,
                last_login_at: new Date(),
            })
            .returningAll()
            .executeTakeFirst()
            .catch((error: unknown) => {
                if (isUniqueViolation(error)) throw new ConflictError('That email is already registered');

                throw error;
            });

        if (!user) throw new AppError(500, 'INTERNAL_SERVER_ERROR', 'Account was not created');

        await trx.updateTable('invites').set({ used_by: user.id }).where('id', '=', invite.id).execute();

        return { user, refreshToken: await issueRefreshToken(trx, user.id) };
    });
}
