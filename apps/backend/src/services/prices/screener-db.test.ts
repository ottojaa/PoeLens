import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runCycle } from '../../collector/runtime.js';
import { createPoeNinjaPoe2Adapter } from '../../collector/sources/poe-ninja/poe2.js';
import { createPgCollectorStore } from '../../collector/store-pg.js';
import { FakeNinja } from '../../testing/fake-ninja.js';
import { insertEarlierPrice, insertEarlierRaw, loadItemId, T, type EarlierPrice } from '../../testing/seed-history.js';
import { createTestDatabase, SKIP_DB_TESTS, type TestDatabase } from '../../testing/test-database.js';
import { getScreener, getPairSeries, type ScreenerQuery } from './index.js';

describe.skipIf(SKIP_DB_TESTS)('the screener and pair series against TimescaleDB', () => {
    let test: TestDatabase;
    let earlier: number;
    const ids: Record<string, number> = {};

    beforeAll(async () => {
        test = await createTestDatabase();
    });

    afterAll(async () => {
        await test.close();
    });

    beforeEach(async () => {
        await sql`TRUNCATE prices, item_keys, items, raw_responses, collector_runs, leagues RESTART IDENTITY CASCADE`.execute(test.db);
        await runCycle({
            adapter: createPoeNinjaPoe2Adapter({ leagues: ['Forbidden Rites'] }),
            store: createPgCollectorStore(test.db),
            fetcher: new FakeNinja(),
            now: () => new Date(T),
        });
        earlier = await insertEarlierRaw(test.db);

        for (const name of ['Divine Orb', 'Exalted Orb', 'Chaos Orb', 'Orb of Annulment', 'Mirror of Kalandra']) ids[name] = await loadItemId(test.db, name);
    });

    const seed = (name: string, hoursAgo: number, price: EarlierPrice) => insertEarlierPrice(test.db, earlier, ids[name]!, hoursAgo, price);
    const screen = (query: Partial<ScreenerQuery> = {}) =>
        getScreener(test.db, {
            game: 'poe2',
            league: 'current',
            unit: 'divine',
            categories: ['Currency'],
            windowHours: 3,
            direction: 'up',
            minChangePct: 20,
            minLiquidity: 0,
            minDivine: null,
            limit: 10,
            ...query,
        });
    const names = async (query: Partial<ScreenerQuery> = {}) => (await screen(query)).rows.map((row) => row.item.name);

    describe('the screener', () => {
        beforeEach(async () => {
            await seed('Divine Orb', 3, { divineFactor: 1.5 });
            await seed('Exalted Orb', 3, { divineFactor: 1.25 });
            await seed('Chaos Orb', 3, { divineFactor: 1.1 });
            await seed('Mirror of Kalandra', 3, { divineFactor: 0.5 });
        });

        it('keeps what rose by the minimum or more over the window, strongest first, with the window change', async () => {
            const { rows } = await screen();

            expect(rows.map((row) => row.item.name)).toEqual(['Divine Orb', 'Exalted Orb']);
            expect(rows.map((row) => row.windowChange)).toEqual([50, 25]);
        });

        it('takes a minimum as a magnitude: the same number going down keeps what fell', async () => {
            const { rows } = await screen({ direction: 'down' });

            expect(rows.map((row) => [row.item.name, row.windowChange])).toEqual([['Mirror of Kalandra', -50]]);
        });

        it('gives a lower minimum more rows, and ranks by the change, not the size', async () => {
            expect(await names({ minChangePct: 10 })).toEqual(['Divine Orb', 'Exalted Orb', 'Chaos Orb']);
        });

        it('cuts to the limit after ranking', async () => {
            expect(await names({ minChangePct: 10, limit: 2 })).toEqual(['Divine Orb', 'Exalted Orb']);
        });

        it('measures against the price a window ago, whatever the window (1 h, 7 d, and one off the grid)', async () => {
            await seed('Orb of Annulment', 1, { divineFactor: 2 });
            await seed('Orb of Annulment', 7 * 24, { divineFactor: 4 });
            await seed('Chaos Orb', 5, { divineFactor: 1.3 });

            expect(await names({ windowHours: 1 })).toEqual(['Orb of Annulment']);
            expect((await screen({ windowHours: 7 * 24 })).rows.map((row) => [row.item.name, row.windowChange])).toEqual([['Orb of Annulment', 300]]);
            // A 5 hour window takes the price nearest to 5 hours ago: Chaos Orb has two (3 and 5 hours old), the 5 hour one wins.
            expect((await screen({ windowHours: 5 })).rows.map((row) => [row.item.name, row.windowChange])).toEqual([
                ['Divine Orb', 50],
                ['Chaos Orb', 30],
                ['Exalted Orb', 25],
            ]);
        });

        it('has nothing to say about an item without a price a window ago', async () => {
            expect(await names({ windowHours: 24 })).toEqual([]);
        });

        it('ignores a reference price with low confidence, even a wild one', async () => {
            await seed('Orb of Annulment', 3, { divineFactor: 10, lowConfidence: true });

            expect(await names()).not.toContain('Orb of Annulment');
        });

        it('leaves out an item whose price now has low confidence', async () => {
            await sql`UPDATE prices SET low_confidence = true WHERE item_id = ${ids['Divine Orb']!} AND time = ${new Date(T)}`.execute(test.db);

            expect(await names()).toEqual(['Exalted Orb']);
        });

        it('wants the minimum liquidity: listings, or volume for an exchange item', async () => {
            const volume = (
                await test.db
                    .selectFrom('prices')
                    .select('volume')
                    .where('item_id', '=', ids['Divine Orb']!)
                    .where('time', '=', new Date(T))
                    .executeTakeFirstOrThrow()
            ).volume!;

            expect(await names({ minLiquidity: volume + 1 })).not.toContain('Divine Orb');
            expect(await names({ minLiquidity: volume })).toContain('Divine Orb');
        });

        it('wants the minimum worth in divine', async () => {
            const worth = (
                await test.db
                    .selectFrom('prices')
                    .select('divine')
                    .where('item_id', '=', ids['Exalted Orb']!)
                    .where('time', '=', new Date(T))
                    .executeTakeFirstOrThrow()
            ).divine;

            expect(await names({ minDivine: worth * 2 })).not.toContain('Exalted Orb');
            expect(await names({ minDivine: worth / 2 })).toContain('Exalted Orb');
        });

        it('stays in the categories asked for', async () => {
            expect(await names({ categories: ['Fragments'] })).toEqual([]);
            expect(await names({ categories: [] })).toEqual([]);
        });

        it('is empty without snapshots, rather than an error', async () => {
            await sql`TRUNCATE prices, raw_responses RESTART IDENTITY CASCADE`.execute(test.db);

            expect((await screen()).rows).toEqual([]);
        });
    });

    describe('the ranking unit', () => {
        it('ranks and measures in the unit asked: an item can lead in one and trail in the other', async () => {
            // Annulment doubled in divine but the exalted rate moved too: in exalted it only rose by a half. Chaos is the other way round.
            await seed('Orb of Annulment', 3, { divineFactor: 2, exaltedFactor: 1.5 });
            await seed('Chaos Orb', 3, { divineFactor: 1.5, exaltedFactor: 3 });

            const inDivine = await screen({ unit: 'divine' });
            const inExalted = await screen({ unit: 'exalted' });

            expect(inDivine.rows.map((row) => [row.item.name, row.windowChange])).toEqual([
                ['Orb of Annulment', 100],
                ['Chaos Orb', 50],
            ]);
            expect(inExalted.rows.map((row) => [row.item.name, row.windowChange])).toEqual([
                ['Chaos Orb', 200],
                ['Orb of Annulment', 50],
            ]);
            expect(inExalted.unit).toBe('exalted');
        });
    });

    describe('pair series', () => {
        const series = (a: string, b: string, bucket: 'hour' | 'day' = 'hour') =>
            getPairSeries(test.db, {
                game: 'poe2',
                league: 'current',
                a: ids[a]!,
                b: ids[b]!,
                bucket,
                from: new Date(T - 48 * 3_600_000),
                to: new Date(T + 3_600_000),
            });

        it('divides the two sides bucket by bucket, in divine, and keeps the newest point', async () => {
            await seed('Divine Orb', 2, { divineFactor: 2 });
            await seed('Exalted Orb', 2, { divineFactor: 4 });

            const { points, a, b } = await series('Divine Orb', 'Exalted Orb');
            const now = await test.db
                .selectFrom('prices')
                .select(['item_id', 'divine'])
                .where('time', '=', new Date(T))
                .where('item_id', 'in', [ids['Divine Orb']!, ids['Exalted Orb']!])
                .execute();
            const divine = now.find((row) => row.item_id === ids['Divine Orb'])!.divine;
            const exalted = now.find((row) => row.item_id === ids['Exalted Orb'])!.divine;

            expect([a.name, b.name]).toEqual(['Divine Orb', 'Exalted Orb']);
            expect(points.map((point) => point.time)).toEqual([new Date(T - 2 * 3_600_000).toISOString(), new Date(T).toISOString()]);
            expect(points[0]?.price).toBeCloseTo(divine / 2 / (exalted / 4), 6);
            expect(points[1]?.price).toBeCloseTo(divine / exalted, 6);
        });

        it('drops a bucket where one side has no confident price', async () => {
            await seed('Divine Orb', 2, { divineFactor: 2 });
            await seed('Divine Orb', 5, { divineFactor: 2 });
            await seed('Exalted Orb', 2, { divineFactor: 4 });
            await seed('Exalted Orb', 5, { divineFactor: 4, lowConfidence: true });

            const { points } = await series('Divine Orb', 'Exalted Orb');

            expect(points.map((point) => point.time)).toEqual([new Date(T - 2 * 3_600_000).toISOString(), new Date(T).toISOString()]);
        });

        it('is empty when a side has no history at all, and refuses an unknown item', async () => {
            await sql`DELETE FROM prices WHERE item_id = ${ids['Chaos Orb']!}`.execute(test.db);

            expect((await series('Divine Orb', 'Chaos Orb')).points).toEqual([]);
            await expect(
                getPairSeries(test.db, {
                    game: 'poe2',
                    league: 'current',
                    a: ids['Divine Orb']!,
                    b: 2_000_000,
                    bucket: 'hour',
                    from: new Date(T - 3_600_000),
                    to: new Date(T + 1),
                }),
            ).rejects.toMatchObject({
                statusCode: 404,
            });
        });
    });
});
