import { closeDb, db } from '../../db/kysely.js';
import { issueBootstrapAdminInvite } from './index.js';

/**
 * Issues the invite for the first admin and prints its path. Open `<the web app's origin><path>` and register there:
 * the same page friends use, so there is no second way to create an account and no password on the command line.
 * Dev: `nx run @poelens/backend:bootstrap-admin`. Production, in the image: `node apps/backend/dist/apps/backend/src/services/auth/bootstrap-admin.js`.
 * Run it again for a fresh link if the first one was lost or expired; it refuses while an active admin exists.
 */
async function main(): Promise<void> {
    const { invite, token } = await issueBootstrapAdminInvite(db);

    console.log('Admin invite, valid until ' + invite.expiresAt + ' and usable once. Open this path on the web app:');
    console.log('/invite/' + token);
}

main()
    .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    })
    .finally(closeDb);
