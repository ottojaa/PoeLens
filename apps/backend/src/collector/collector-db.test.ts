import { Pool } from 'pg';
import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FakeNinja, fixture } from '../testing/fake-ninja.js';
import { createTestDatabase, SKIP_DB_TESTS, type TestDatabase } from '../testing/test-database.js';
import { withCollectorLock } from './lock.js';
import { reparseRaw } from './reparse-raw.js';
import { runCycle } from './runtime.js';
import { createPoeNinjaPoe2Adapter } from './sources/poe-ninja/poe2.js';
import { createPgCollectorStore } from './store-pg.js';

describe.skipIf(SKIP_DB_TESTS)('the collector against TimescaleDB', () => {
    let test: TestDatabase;
    let ninja: FakeNinja;
    const adapter = createPoeNinjaPoe2Adapter({ leagues: ['Forbidden Rites'] });

    beforeAll(async () => {
        test = await createTestDatabase();
    });

    afterAll(async () => {
        await test.close();
    });

    beforeEach(async () => {
        ninja = new FakeNinja();
        await sql`TRUNCATE prices, item_keys, items, raw_responses, collector_runs, leagues RESTART IDENTITY CASCADE`.execute(test.db);
    });

    function cycle(tick = 0) {
        const store = createPgCollectorStore(test.db);

        return runCycle({ adapter, store, fetcher: ninja, now: () => new Date(Date.UTC(2026, 10, 23, 12, 0, tick)) });
    }

    async function count(table: 'prices' | 'items' | 'item_keys' | 'raw_responses' | 'leagues' | 'collector_runs'): Promise<number> {
        const row = await test.db
            .selectFrom(table)
            .select((eb) => eb.fn.countAll<string>().as('n'))
            .executeTakeFirstOrThrow();

        return Number(row.n);
    }

    async function allPrices() {
        return test.db.selectFrom('prices').selectAll().orderBy('game').orderBy('league').orderBy('item_id').orderBy('time').execute();
    }

    it('stores leagues, items, prices and raw rows from one cycle', async () => {
        const summary = await cycle();

        expect(summary).toMatchObject({ status: 'success', requests: 24, stored: 24 });
        // Every category is its own set of items: 14 exchange types of 12 lines and 9 stash types of 6 lines.
        expect(await count('items')).toBe(14 * 12 + 9 * 6);
        expect(await count('item_keys')).toBe(14 * 12 + 9 * 6);
        expect(await count('raw_responses')).toBe(24);
        expect(await count('prices')).toBe(14 * 12 + 9 * 6);
        expect(await count('leagues')).toBe(6);
        expect(await count('collector_runs')).toBe(1);

        const run = await test.db.selectFrom('collector_runs').selectAll().executeTakeFirstOrThrow();

        expect(run).toMatchObject({ status: 'success', requests: 24, stored: 24, price_rows: 14 * 12 + 9 * 6, parse_errors: 0 });
        expect(run.finished_at).not.toBeNull();
    });

    it('marks the first listed league and its hardcore version current', async () => {
        await cycle();

        const current = await test.db.selectFrom('leagues').select('name').where('current', '=', true).orderBy('name').execute();

        expect(current.map((league) => league.name)).toEqual(['Forbidden Rites', 'HC Forbidden Rites']);
    });

    it('stores the converted prices of an item in all three units, with its own rates', async () => {
        await cycle();

        const divine = await test.db
            .selectFrom('prices')
            .innerJoin('items', 'items.id', 'prices.item_id')
            .select(['prices.divine', 'prices.exalted', 'prices.chaos', 'prices.low_confidence', 'prices.listings', 'prices.volume'])
            .where('items.name', '=', 'Divine Orb')
            .executeTakeFirstOrThrow();

        expect(divine).toMatchObject({ divine: 1, exalted: 445.9, chaos: 13.44, low_confidence: false, listings: null });
    });

    it('a second cycle gets 304s and stores no new price rows', async () => {
        await cycle(0);

        const before = await allPrices();
        const second = await cycle(60);

        expect(second).toMatchObject({ status: 'success', unchanged: 24, stored: 0, priceRows: 0 });
        expect(await allPrices()).toEqual(before);
        expect(await count('raw_responses')).toBe(24);
        expect(await count('collector_runs')).toBe(2);
    });

    it('a changed body adds one snapshot of rows and keeps the same item ids', async () => {
        await cycle(0);

        const idsBefore = await test.db.selectFrom('items').select(['id', 'name']).orderBy('id').execute();
        const changed = JSON.parse(fixture('stash-unique-weapons.json').toString('utf8'));

        changed.lines[1].primaryValue *= 2;
        ninja.overrides.set('https://poe.ninja/poe2/api/economy/stash/current/item/overview?league=Forbidden+Rites&type=UniqueWeapons', {
            body: Buffer.from(JSON.stringify(changed)),
        });

        await cycle(60);

        expect(await count('prices')).toBe(14 * 12 + 9 * 6 + 6);
        expect(await test.db.selectFrom('items').select(['id', 'name']).orderBy('id').execute()).toEqual(idsBefore);
    });

    it('makes a league that appears first current, and retires the old one, with no code change', async () => {
        await cycle(0);
        ninja.leagues = fixture('leagues-new-first-league.json');

        const store = createPgCollectorStore(test.db);

        await runCycle({ adapter: createPoeNinjaPoe2Adapter(), store, fetcher: ninja, now: () => new Date(Date.UTC(2026, 10, 23, 13, 0, 0)) });

        const current = await test.db.selectFrom('leagues').select('name').where('current', '=', true).orderBy('name').execute();
        const collected = await test.db.selectFrom('prices').select('league').distinct().orderBy('league').execute();

        expect(current.map((league) => league.name)).toEqual(['HC Rise of the Abyssal', 'Rise of the Abyssal']);
        expect(collected.map((row) => row.league)).toEqual(['Forbidden Rites', 'HC Rise of the Abyssal', 'Rise of the Abyssal']);
    });

    it('reparse reproduces identical prices rows, and repairs rows a bad parse left behind', async () => {
        await cycle();

        const before = await allPrices();
        const store = createPgCollectorStore(test.db);
        const result = await reparseRaw(adapter, store, { kind: 'exchange' });

        expect(result).toEqual({ parsed: 14, parseErrors: 0, priceRows: 14 * 12 });
        expect(await allPrices()).toEqual(before);

        await sql`UPDATE prices SET divine = 0, low_confidence = NOT low_confidence`.execute(test.db);
        await reparseRaw(adapter, store, {});

        expect(await allPrices()).toEqual(before);
    });

    it('keeps a response whose parse failed, records why, and can parse it again', async () => {
        ninja.overrides.set('https://poe.ninja/poe2/api/economy/exchange/current/overview?league=Forbidden+Rites&type=Currency', {
            body: Buffer.from('{"unexpected":1}'),
        });

        const summary = await cycle();
        const broken = await test.db
            .selectFrom('raw_responses')
            .select(['parser_version', 'parse_error'])
            .where('category', '=', 'Currency')
            .executeTakeFirstOrThrow();

        expect(summary).toMatchObject({ status: 'partial', parseErrors: 1 });
        expect(broken.parser_version).toBeNull();
        expect(broken.parse_error).toMatch(/^Unexpected exchange response/);
    });

    it('lets one process hold the collector lock at a time, and frees it afterwards', async () => {
        const pool = new Pool({ connectionString: test.url, max: 3 });

        try {
            let inner: unknown;
            const outer = await withCollectorLock(pool, async () => {
                inner = await withCollectorLock(pool, async () => 'second');

                return 'first';
            });

            expect(outer).toEqual({ ran: true, value: 'first' });
            expect(inner).toEqual({ ran: false });
            expect(await withCollectorLock(pool, async () => 'again')).toEqual({ ran: true, value: 'again' });
        } finally {
            await pool.end();
        }
    });

    it('frees the lock when the work throws', async () => {
        const pool = new Pool({ connectionString: test.url, max: 2 });

        try {
            await expect(
                withCollectorLock(pool, async () => {
                    throw new Error('boom');
                }),
            ).rejects.toThrow('boom');
            expect(await withCollectorLock(pool, async () => 'after')).toEqual({ ran: true, value: 'after' });
        } finally {
            await pool.end();
        }
    });

    it('marks a cycle a crashed process left running as abandoned', async () => {
        const store = createPgCollectorStore(test.db);
        const crashed = await store.startRun('poe.ninja', 'poe2', new Date(Date.UTC(2026, 10, 23, 11, 0, 0)));

        expect(await store.abandonStaleRuns(new Date(Date.UTC(2026, 10, 23, 12, 0, 0)))).toBe(1);

        const run = await test.db.selectFrom('collector_runs').selectAll().where('id', '=', crashed).executeTakeFirstOrThrow();

        expect(run.status).toBe('abandoned');
        expect(run.finished_at).not.toBeNull();
        expect(await store.findLastRunStart('poe.ninja', 'poe2')).toEqual(new Date(Date.UTC(2026, 10, 23, 11, 0, 0)));
    });
});
