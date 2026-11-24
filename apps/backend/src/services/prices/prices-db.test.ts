import { HistoryQuerySchema, LatestQuerySchema, MoversQuerySchema, NotFoundError, SearchQuerySchema, TableQuerySchema, ValidationError } from '@poelens/shared';
import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runCycle } from '../../collector/runtime.js';
import { createPoeNinjaPoe2Adapter } from '../../collector/sources/poe-ninja/poe2.js';
import { createPgCollectorStore } from '../../collector/store-pg.js';
import { FakeNinja, fixture } from '../../testing/fake-ninja.js';
import { createTestDatabase, SKIP_DB_TESTS, type TestDatabase } from '../../testing/test-database.js';
import { getHistory, getLatest, getMovers, getTable, listLeagues, searchItems } from './index.js';

const T = Date.UTC(2026, 10, 23, 12, 0, 0);
const HOUR = 3_600_000;
const CURRENCY_URL = 'https://poe.ninja/poe2/api/economy/exchange/current/overview?league=Forbidden+Rites&type=Currency';

describe.skipIf(SKIP_DB_TESTS)('the price read side against TimescaleDB', () => {
    let test: TestDatabase;
    let ninja: FakeNinja;
    const adapter = createPoeNinjaPoe2Adapter({ leagues: ['Forbidden Rites'] });

    beforeAll(async () => {
        test = await createTestDatabase();
    });

    afterAll(async () => {
        await test.close();
    });

    function cycleAt(time: number) {
        return runCycle({ adapter, store: createPgCollectorStore(test.db), fetcher: ninja, now: () => new Date(time) });
    }

    async function itemId(name: string, category = 'Currency'): Promise<number> {
        const row = await test.db.selectFrom('items').select('id').where('name', '=', name).where('category', '=', category).executeTakeFirstOrThrow();

        return row.id;
    }

    /** An older archived response for the earlier points to belong to, so they are history and not part of the latest snapshot. */
    async function insertEarlierRaw(): Promise<number> {
        const row = await test.db
            .insertInto('raw_responses')
            .values({
                source: 'poe.ninja',
                game: 'poe2',
                kind: 'exchange',
                league: 'Forbidden Rites',
                category: 'Currency',
                url: CURRENCY_URL,
                fetched_at: new Date(T - 8 * 24 * HOUR),
                status: 200,
                etag: null,
                sha256: 'earlier',
                body: Buffer.alloc(0),
                parser_version: 1,
            })
            .returning('id')
            .executeTakeFirstOrThrow();

        return row.id;
    }

    /** One earlier price of Divine Orb: its current price times `factor`, so a factor of 2 means the price has halved since. */
    async function insertDivinePoint(rawId: number, time: number, factor: number, lowConfidence = false) {
        await test.db
            .insertInto('prices')
            .values({
                time: new Date(time),
                game: 'poe2',
                league: 'Forbidden Rites',
                item_id: await itemId('Divine Orb'),
                source: 'poe.ninja',
                divine: factor,
                exalted: 445.9 * factor,
                chaos: 13.44 * factor,
                listings: null,
                volume: 10_397,
                low_confidence: lowConfidence,
                raw_id: rawId,
            })
            .execute();
    }

    beforeEach(async () => {
        ninja = new FakeNinja();
        await sql`TRUNCATE prices, item_keys, items, raw_responses, collector_runs, leagues RESTART IDENTITY CASCADE`.execute(test.db);
        await cycleAt(T);

        const earlier = await insertEarlierRaw();

        await insertDivinePoint(earlier, T - HOUR, 2);
        await insertDivinePoint(earlier, T - 24 * HOUR, 0.5);
        await insertDivinePoint(earlier, T - 24 * HOUR + 10 * 60_000, 0.001, true);
        await insertDivinePoint(earlier, T - 7 * 24 * HOUR, 1);
    });

    const table = (query: Record<string, string>) => getTable(test.db, TableQuerySchema.parse({ game: 'poe2', category: 'Currency', ...query }));

    describe('table', () => {
        it('answers in the current league and the default unit, without low-confidence rows', async () => {
            const response = await table({});

            expect(response).toMatchObject({
                game: 'poe2',
                league: { name: 'Forbidden Rites', current: true, hardcore: false },
                unit: 'exalted',
                category: 'Currency',
            });
            expect(response.rows).toHaveLength(11);
            expect(response.rows.map((row) => row.item.name)).not.toContain("Yaomac's Orb of Sacrifice");
            expect(response.rows.every((row) => !row.lowConfidence)).toBe(true);
            expect(response.rows[0]?.item.name).toBe('Mirror of Kalandra');
        });

        it('keeps the low-confidence rows, flagged, when asked', async () => {
            const response = await table({ includeLowConfidence: 'true' });

            expect(response.rows).toHaveLength(12);
            expect(response.rows.filter((row) => row.lowConfidence)).toHaveLength(1);
        });

        it("prices in the requested unit with each response's own rates", async () => {
            const price = async (unit: string) => (await table({ unit })).rows.find((row) => row.item.name === 'Divine Orb')?.price;

            expect(await price('exalted')).toBe(445.9);
            expect(await price('chaos')).toBe(13.44);
            expect(await price('divine')).toBe(1);
        });

        it('carries per-row freshness, liquidity kind and change over 1h, 24h and 7d', async () => {
            const divine = (await table({})).rows.find((row) => row.item.name === 'Divine Orb');

            expect(divine).toMatchObject({
                asOf: new Date(T).toISOString(),
                liquidity: { kind: 'volume', value: 10_397 },
                change: { h1: -50, h24: 100, d7: 0 },
            });
        });

        it('has no change where there is no reference price yet', async () => {
            const exalted = (await table({})).rows.find((row) => row.item.name === 'Exalted Orb');

            expect(exalted?.change).toEqual({ h1: null, h24: null, d7: null });
        });

        it('shows listings as the liquidity of stash items', async () => {
            const response = await table({ category: 'UniqueWeapons', includeLowConfidence: 'true' });
            const shank = response.rows.find((row) => row.item.name === "Winter's Bite");

            expect(shank).toMatchObject({ lowConfidence: true, liquidity: { kind: 'listings', value: 1 } });
        });

        it('answers a league with no data with no rows, and an unknown league with not found', async () => {
            expect((await table({ league: 'HC Forbidden Rites' })).rows).toEqual([]);
            await expect(table({ league: 'Nowhere' })).rejects.toBeInstanceOf(NotFoundError);
        });

        describe('sparklines', () => {
            const sparkline = async (name: string, query: Record<string, string> = {}) => {
                const response = await table({ sparkline: 'true', ...query });

                return response.rows.find((row) => row.item.name === name)?.sparkline;
            };

            it('leaves the field out unless asked, so the old shape is unchanged', async () => {
                const response = await table({});

                expect(response.rows.every((row) => !('sparkline' in row))).toBe(true);
            });

            it('holds the last 7 UTC days of daily prices, without low-confidence points or older days', async () => {
                // Divine Orb has a point 7 days back (outside the window), one a day back, a low-confidence one a day back, and now.
                expect(await sparkline('Divine Orb')).toEqual([222.95, 445.9]);
            });

            it('is in the requested unit', async () => {
                expect(await sparkline('Divine Orb', { unit: 'divine' })).toEqual([0.5, 1]);
            });

            it('has the points history returns for the same days, for items with a long and a short history', async () => {
                for (const name of ['Divine Orb', 'Exalted Orb']) {
                    const item = await itemId(name);
                    const response = await getHistory(
                        test.db,
                        HistoryQuerySchema.parse({
                            game: 'poe2',
                            item: String(item),
                            bucket: 'day',
                            from: '2026-11-17T00:00:00.000Z',
                            to: '2026-11-24T00:00:00.000Z',
                        }),
                    );

                    expect(await sparkline(name)).toEqual(response.points.map((point) => point.price));
                }
            });

            it('has a single point for an item with one day of history, and none for an item that only has low-confidence prices', async () => {
                expect(await sparkline('Exalted Orb')).toHaveLength(1);
                expect(await sparkline("Yaomac's Orb of Sacrifice", { includeLowConfidence: 'true' })).toEqual([]);
            });
        });
    });

    describe('latest', () => {
        it("lists an item missing from its category's newest snapshot as unlisted, not at its old price", async () => {
            const body = JSON.parse(fixture('exchange-currency.json').toString('utf8')) as { lines: { id: string }[] };

            body.lines = body.lines.filter((line) => line.id !== 'divine');
            ninja.overrides.set(CURRENCY_URL, { body: Buffer.from(JSON.stringify(body)) });
            await cycleAt(T + HOUR);

            const divine = await itemId('Divine Orb');
            const exalted = await itemId('Exalted Orb');
            const response = await getLatest(test.db, LatestQuerySchema.parse({ game: 'poe2', items: `${divine},${exalted},999999` }));

            expect(response.rows.map((row) => row.item.id)).toEqual([exalted]);
            expect(response.rows[0]?.asOf).toBe(new Date(T + HOUR).toISOString());
            expect(response.unlisted).toEqual([divine, 999999]);
        });

        it('treats a low-confidence item as unlisted unless asked', async () => {
            const shank = await itemId("Winter's Bite", 'UniqueWeapons');
            const query = { game: 'poe2', items: String(shank) };

            expect((await getLatest(test.db, LatestQuerySchema.parse(query))).unlisted).toEqual([shank]);

            const withLow = await getLatest(test.db, LatestQuerySchema.parse({ ...query, includeLowConfidence: 'true' }));

            expect(withLow.unlisted).toEqual([]);
            expect(withLow.rows[0]?.price).toBeCloseTo(39_235_000 * 495.3, -3);
        });
    });

    describe('history', () => {
        const history = async (query: Record<string, string>) =>
            getHistory(test.db, HistoryQuerySchema.parse({ game: 'poe2', item: String(await itemId('Divine Orb')), ...query }), new Date(T + HOUR));

        it('buckets by hour: the last price of each hour', async () => {
            const response = await history({ bucket: 'hour', from: new Date(T - 2 * HOUR).toISOString(), to: new Date(T + HOUR).toISOString() });

            expect(response).toMatchObject({
                game: 'poe2',
                unit: 'exalted',
                bucket: 'hour',
                item: { name: 'Divine Orb' },
                league: { name: 'Forbidden Rites' },
            });
            expect(response.points).toEqual([
                { time: new Date(T - HOUR).toISOString(), price: 891.8, low: 891.8, high: 891.8 },
                { time: new Date(T).toISOString(), price: 445.9, low: 445.9, high: 445.9 },
            ]);
        });

        it('buckets by day, with the last price, low and high of the day, and no low-confidence points', async () => {
            const response = await history({ bucket: 'day', from: '2026-11-16T00:00:00.000Z', to: '2026-11-24T00:00:00.000Z' });

            expect(response.points).toEqual([
                { time: '2026-11-16T00:00:00.000Z', price: 445.9, low: 445.9, high: 445.9 },
                { time: '2026-11-22T00:00:00.000Z', price: 222.95, low: 222.95, high: 222.95 },
                { time: '2026-11-23T00:00:00.000Z', price: 445.9, low: 445.9, high: 891.8 },
            ]);
        });

        it('includes low-confidence points when asked', async () => {
            const response = await history({ bucket: 'day', from: '2026-11-22T00:00:00.000Z', to: '2026-11-23T00:00:00.000Z', includeLowConfidence: 'true' });

            expect(response.points[0]).toMatchObject({ low: 445.9 * 0.001, high: 222.95 });
        });

        it('defaults to the last week by hour, ending now', async () => {
            const response = await history({});

            expect(response.to).toBe(new Date(T + HOUR).toISOString());
            expect(response.from).toBe(new Date(T + HOUR - 7 * 24 * HOUR).toISOString());
        });

        it('refuses a range with too many points, an empty range and an unknown item', async () => {
            await expect(history({ bucket: 'hour', from: '2026-01-01T00:00:00.000Z' })).rejects.toBeInstanceOf(ValidationError);
            await expect(history({ from: '2026-11-23T00:00:00.000Z', to: '2026-11-22T00:00:00.000Z' })).rejects.toBeInstanceOf(ValidationError);
            await expect(history({ item: '999999' })).rejects.toBeInstanceOf(NotFoundError);
        });
    });

    describe('movers', () => {
        const movers = (query: Record<string, string>) => getMovers(test.db, MoversQuerySchema.parse({ game: 'poe2', ...query }));

        it('ranks risers and fallers over the window', async () => {
            const day = await movers({ window: '24h' });
            const hour = await movers({ window: '1h' });

            expect(day.window).toBe('24h');
            expect(day.risers.map((row) => [row.item.name, row.change.h24])).toEqual([['Divine Orb', 100]]);
            expect(day.fallers).toEqual([]);
            expect(hour.fallers.map((row) => [row.item.name, row.change.h1])).toEqual([['Divine Orb', -50]]);
            expect(hour.risers).toEqual([]);
        });

        it('leaves out items with no change over the window', async () => {
            const week = await movers({ window: '7d' });

            expect(week.risers).toEqual([]);
            expect(week.fallers).toEqual([]);
        });

        it('stays within a category when given one', async () => {
            const response = await movers({ category: 'UniqueWeapons' });

            expect(response.risers).toEqual([]);
        });
    });

    describe('search', () => {
        const search = (q: string) => searchItems(test.db, SearchQuerySchema.parse({ game: 'poe2', q }));

        it('finds Divine Orb from the typo "divne", ahead of a name that only shares trigrams', async () => {
            await test.db
                .insertInto('items')
                .values({ game: 'poe2', name: 'Sanguine Diviner', base_type: 'Bone Wand', category: 'UniqueWeapons', icon: null })
                .execute();

            const response = await search('divne');

            expect(response.query).toBe('divne');
            expect(response.results[0]?.item).toMatchObject({ name: 'Divine Orb', category: expect.any(String) });
        });

        it('finds Winter\'s Bite Glass Shank from "shank"', async () => {
            expect((await search('shank')).results[0]?.item).toMatchObject({ name: "Winter's Bite", baseType: 'Glass Shank' });
        });

        it('matches by name or base type', async () => {
            const response = await search('Redbeak');

            expect(response.results[0]?.item).toMatchObject({ name: 'Redbeak', baseType: 'Shortsword' });
            expect((await search('shortsword')).results[0]?.item.baseType).toBe('Shortsword');
        });

        it('finds nothing for another game, or for text unlike any item', async () => {
            expect((await searchItems(test.db, SearchQuerySchema.parse({ game: 'poe1', q: 'divine' }))).results).toEqual([]);
            expect((await search('zzzqqq')).results).toEqual([]);
        });

        it('treats LIKE wildcards as plain text', async () => {
            expect((await search('100%')).results).toEqual([]);
        });
    });

    describe('leagues', () => {
        it('lists the current league and its hardcore version first', async () => {
            const leagues = await listLeagues(test.db, 'poe2');

            expect(leagues.map((league) => league.name)).toEqual([
                'Forbidden Rites',
                'HC Forbidden Rites',
                'Runes of Aldur',
                'Standard',
                'HC Runes of Aldur',
                'Hardcore',
            ]);
            expect(leagues[0]).toMatchObject({ game: 'poe2', current: true, hardcore: false });
            expect(await listLeagues(test.db, 'poe1')).toEqual([]);
        });
    });
});
