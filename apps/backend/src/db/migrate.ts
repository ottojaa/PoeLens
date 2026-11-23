import { promises as fs } from 'fs';
import { FileMigrationProvider, Kysely, Migrator, PostgresDialect, type MigrationResultSet } from 'kysely';
import * as path from 'path';
import { Pool } from 'pg';
import { env } from '../config/env.js';

/**
 * Runs the migrations in ./migrations: `migrate` goes to the latest, `migrate down` rolls back one.
 * Dev: `nx migrate @poelens/backend`. Production: the build emits this file as its own entry (see apps/backend/project.json),
 * so the container runs `node dist/apps/backend/src/db/migrate.js` before the server starts. It uses its own pool:
 * unlike the API's, a
 * migration may legitimately run for longer than a few seconds.
 */
async function main(): Promise<void> {
    const db = new Kysely<unknown>({ dialect: new PostgresDialect({ pool: new Pool({ connectionString: env.DATABASE_URL }) }) });
    const migrator = new Migrator({
        db,
        provider: new FileMigrationProvider({ fs, path, migrationFolder: path.join(__dirname, 'migrations') }),
    });

    const isDown = process.argv[2] === 'down';
    const resultSet = isDown ? await migrator.migrateDown() : await migrator.migrateToLatest();

    await db.destroy();
    report(resultSet, isDown);
}

function report({ error, results }: MigrationResultSet, isDown: boolean): void {
    const verb = isDown ? 'rolled back' : 'applied';

    for (const result of results ?? []) {
        if (result.status === 'Success') console.log(`Migration ${verb}: ${result.migrationName}`);

        if (result.status === 'Error') console.error(`Migration failed: ${result.migrationName}`);
    }

    if (!results?.length && !error) console.log('No migrations to run');

    if (!error) return;

    console.error(error);
    process.exit(1);
}

main().catch((error: unknown) => {
    console.error('Migration runner failed:', error);
    process.exit(1);
});
