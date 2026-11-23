import type { Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';
import { createInvite, type CreatedInvite } from './invites.js';

/**
 * The first admin has no one to invite them, so a command on the server issues an admin invite instead of creating a
 * user with a password. Only one bootstrap link lives at a time: an earlier one (printed to a terminal or a log) is
 * revoked when a new one is issued. Refuses once an admin exists.
 */
export function issueBootstrapAdminInvite(db: Kysely<Database>): Promise<CreatedInvite> {
    return db.transaction().execute(async (trx) => {
        const admin = await trx.selectFrom('users').select('id').where('role', '=', 'admin').limit(1).executeTakeFirst();

        if (admin) throw new Error('An admin already exists: sign in and create invites from the admin page');

        await trx
            .updateTable('invites')
            .set({ revoked_at: new Date() })
            .where('created_by', 'is', null)
            .where('used_at', 'is', null)
            .where('revoked_at', 'is', null)
            .execute();

        return createInvite(trx, { role: 'admin', createdBy: null });
    });
}
