import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, migrateDownAll, migrateUp, SKIP_DB_TESTS, type TestDatabase } from './test-database.js';

describe.skipIf(SKIP_DB_TESTS)('migrations', () => {
    let test: TestDatabase;

    beforeAll(async () => {
        test = await createTestDatabase();
    });

    afterAll(async () => {
        await test.close();
    });

    it('create the price history tables, with prices as a hypertable', async () => {
        const tables = await sql<{ table_name: string }>`
            SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name
        `.execute(test.db);
        const hypertables = await sql<{ hypertable_name: string }>`SELECT hypertable_name FROM timescaledb_information.hypertables`.execute(test.db);

        expect(tables.rows.map((row) => row.table_name)).toEqual(
            expect.arrayContaining(['collector_runs', 'item_keys', 'items', 'leagues', 'prices', 'raw_responses']),
        );
        expect(hypertables.rows.map((row) => row.hypertable_name)).toEqual(['prices']);
    });

    it('compress prices on a policy', async () => {
        const jobs = await sql<{ proc_name: string }>`
            SELECT proc_name FROM timescaledb_information.jobs WHERE hypertable_name = 'prices'
        `.execute(test.db);

        expect(jobs.rows.map((row) => row.proc_name)).toContain('policy_compression');
    });

    it('roll back completely and apply again', async () => {
        await migrateDownAll(test.db);

        const left = await sql<{ table_name: string }>`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name <> 'kysely_migration' AND table_name <> 'kysely_migration_lock'
        `.execute(test.db);

        expect(left.rows).toEqual([]);

        await migrateUp(test.db);

        const hypertables = await sql<{ hypertable_name: string }>`SELECT hypertable_name FROM timescaledb_information.hypertables`.execute(test.db);

        expect(hypertables.rows).toHaveLength(1);
    });
});
