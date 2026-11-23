import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Kysely, Migrator, PostgresDialect, sql, type Migration, type MigrationProvider } from 'kysely';
import { Pool } from 'pg';
import type { Database } from '../db/schema.js';

/**
 * A real TimescaleDB for tests that must prove what a query returns (units, confidence, latest/unlisted, buckets, the
 * advisory lock). Each suite gets its own throwaway database, created on the server `TEST_DATABASE_URL` points at (the
 * compose `postgres` service: `docker compose up -d postgres`), with the real migrations applied. It never touches the
 * `poelens` database: scratch databases are named `poelens_test_*` and dropped afterwards.
 *
 * With no server reachable, `createTestDatabase` throws: a silently skipped suite would let a regression through the gate.
 * `SKIP_DB_TESTS=1` turns the suites into no-ops on purpose (see `SKIP_DB_TESTS`).
 */

export interface TestDatabase {
    db: Kysely<Database>;
    /** The scratch database's connection string, for code that opens its own pool. */
    url: string;
    close: () => Promise<void>;
}

/** True when the database suites are skipped on purpose; use it as `describe.skipIf(SKIP_DB_TESTS)`. */
export const SKIP_DB_TESTS = process.env['SKIP_DB_TESTS'] === '1';

const MIGRATIONS_DIR = join(__dirname, '../db/migrations');

const REQUIRED_EXTENSIONS = ['timescaledb', 'pg_trgm'];

/** The real migration files, loaded through the test runner so their TypeScript needs no build. */
const provider: MigrationProvider = {
    async getMigrations() {
        const files = readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'));
        const entries = await Promise.all(
            files.map(async (file) => [file.replace(/\.ts$/, ''), (await import(join(MIGRATIONS_DIR, file))) as Migration] as const),
        );

        return Object.fromEntries(entries);
    },
};

function toKysely(connectionString: string): Kysely<Database> {
    const pool = new Pool({ connectionString, max: 4 });

    // An idle client dies when its database is dropped. A pool without an error listener turns that into an unhandled
    // error, which fails the whole vitest run after every test passed.
    pool.on('error', () => undefined);

    return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}

/** Applies every migration. */
export async function migrateUp(db: Kysely<Database>): Promise<void> {
    const { error } = await new Migrator({ db, provider }).migrateToLatest();

    if (error) throw error;
}

/** Rolls back every applied migration, newest first. */
export async function migrateDownAll(db: Kysely<Database>): Promise<void> {
    const migrator = new Migrator({ db, provider });

    for (;;) {
        const applied = (await migrator.getMigrations()).filter((migration) => migration.executedAt);

        if (!applied.length) return;

        const { error } = await migrator.migrateDown();

        if (error) throw error;
    }
}

async function createScratchDatabase(adminUrl: string): Promise<{ url: string; drop: () => Promise<void> }> {
    const name = 'poelens_test_' + Math.random().toString(36).slice(2, 10);
    const admin = toKysely(adminUrl);

    await sql`CREATE DATABASE ${sql.id(name)}`.execute(admin);

    const url = new URL(adminUrl);

    url.pathname = '/' + name;

    return {
        url: url.toString(),
        drop: async () => {
            await sql`DROP DATABASE IF EXISTS ${sql.id(name)} WITH (FORCE)`.execute(admin);
            await admin.destroy();
        },
    };
}

/** Fails clearly when the server lacks an extension the migrations need, instead of with a bare error from inside one. */
export async function assertExtensions(db: Kysely<Database>): Promise<void> {
    const { rows } = await sql<{ name: string }>`SELECT name FROM pg_available_extensions WHERE name IN ('timescaledb', 'pg_trgm')`.execute(db);
    const missing = REQUIRED_EXTENSIONS.filter((extension) => !rows.some((row) => row.name === extension));

    if (!missing.length) return;

    throw new Error(
        'The test Postgres lacks extensions: ' +
            missing.join(', ') +
            '. Point TEST_DATABASE_URL at the compose postgres (docker compose up -d postgres). SKIP_DB_TESTS=1 skips these suites on purpose.',
    );
}

export async function createTestDatabase(): Promise<TestDatabase> {
    const adminUrl = process.env['TEST_DATABASE_URL'];

    if (!adminUrl) throw new Error('No Postgres for the database tests: set TEST_DATABASE_URL, or set SKIP_DB_TESTS=1');

    const scratch = await createScratchDatabase(adminUrl);
    const db = toKysely(scratch.url);

    try {
        await assertExtensions(db);
        await migrateUp(db);
    } catch (error) {
        await db.destroy();
        await scratch.drop();

        throw error;
    }

    return {
        db,
        url: scratch.url,
        close: async () => {
            await db.destroy();
            await scratch.drop();
        },
    };
}
