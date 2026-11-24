import { MAX_WATCHLIST_ITEMS, NotFoundError, WatchlistFullError, WatchlistQuerySchema, LatestQuerySchema, type WatchlistQuery } from '@poelens/shared';
import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runCycle } from '../../collector/runtime.js';
import { createPoeNinjaPoe2Adapter } from '../../collector/sources/poe-ninja/poe2.js';
import { createPgCollectorStore } from '../../collector/store-pg.js';
import { seedUser } from '../../testing/auth-helpers.js';
import { FakeNinja } from '../../testing/fake-ninja.js';
import { createTestDatabase, SKIP_DB_TESTS, type TestDatabase } from '../../testing/test-database.js';
import { getItemRows, getLatest } from '../prices/index.js';
import { getWatchlist, unwatchItem, watchItem } from './index.js';

const T = Date.UTC(2026, 10, 23, 12, 0, 0);

describe.skipIf(SKIP_DB_TESTS)('the watchlist against TimescaleDB', () => {
    let test: TestDatabase;
    let alice: string;
    let bob: string;

    beforeAll(async () => {
        test = await createTestDatabase();
        await runCycle({
            adapter: createPoeNinjaPoe2Adapter({ leagues: ['Forbidden Rites'] }),
            store: createPgCollectorStore(test.db),
            fetcher: new FakeNinja(),
            now: () => new Date(T),
        });
        alice = await seedUser(test.db, { email: 'alice@example.com' });
        bob = await seedUser(test.db, { email: 'bob@example.com' });
    });

    afterAll(async () => {
        await test.close();
    });

    beforeEach(async () => {
        await sql`TRUNCATE watchlist_items`.execute(test.db);
        await test.db.deleteFrom('items').where('category', '=', 'Filler').execute();
    });

    async function itemId(name: string): Promise<number> {
        const row = await test.db.selectFrom('items').select('id').where('name', '=', name).executeTakeFirstOrThrow();

        return row.id;
    }

    /** Items with no prices at all, to fill a list up to its limit. */
    async function insertFiller(count: number, game = 'poe2'): Promise<number[]> {
        const rows = await test.db
            .insertInto('items')
            .values(Array.from({ length: count }, (_, index) => ({ game, name: `Filler ${game} ${index}`, category: 'Filler' })))
            .returning('id')
            .execute();

        return rows.map((row) => row.id);
    }

    const list = (userId: string, query: Partial<WatchlistQuery> = {}) => getWatchlist(test.db, userId, WatchlistQuerySchema.parse({ game: 'poe2', ...query }));

    const watchedIds = async (userId: string) =>
        (await test.db.selectFrom('watchlist_items').select('item_id').where('user_id', '=', userId).execute()).map((row) => row.item_id).sort((a, b) => a - b);

    describe('listing', () => {
        it('is empty for a user who watches nothing, with the league and unit resolved', async () => {
            const response = await list(alice);

            expect(response).toMatchObject({ game: 'poe2', league: { name: 'Forbidden Rites', current: true }, unit: 'exalted', rows: [], unlisted: [] });
        });

        it('prices watched items across categories, most valuable first, each with its sparkline and added time', async () => {
            const divine = await itemId('Divine Orb');
            const weapon = await itemId('The Ordained');

            await watchItem(test.db, alice, divine);
            await watchItem(test.db, alice, weapon);

            const response = await list(alice);

            expect(response.rows.map((row) => row.item.name).sort()).toEqual(['Divine Orb', 'The Ordained']);
            expect(response.rows.every((row) => Array.isArray(row.sparkline) && !Number.isNaN(Date.parse(row.addedAt)))).toBe(true);
            expect(response.rows[0]?.price).toBeGreaterThanOrEqual(response.rows[1]?.price ?? 0);
            expect(response.unlisted).toEqual([]);
        });

        it('includes low-confidence items, flagged, because the user chose to watch them', async () => {
            const shank = await itemId("Winter's Bite");

            await watchItem(test.db, alice, shank);

            const response = await list(alice);

            expect(response.rows).toHaveLength(1);
            expect(response.rows[0]).toMatchObject({ lowConfidence: true, item: { name: "Winter's Bite" } });
        });

        it('prices in the requested unit', async () => {
            await watchItem(test.db, alice, await itemId('Divine Orb'));

            expect((await list(alice, { unit: 'divine' })).rows[0]?.price).toBe(1);
            expect((await list(alice, { unit: 'chaos' })).rows[0]?.price).toBe(13.44);
        });

        it('lists a watched item with no price in the league as unlisted, with its item and added time', async () => {
            const [filler] = await insertFiller(1);
            const divine = await itemId('Divine Orb');

            await watchItem(test.db, alice, divine);
            await watchItem(test.db, alice, filler ?? 0);

            const response = await list(alice);

            expect(response.rows.map((row) => row.item.name)).toEqual(['Divine Orb']);
            expect(response.unlisted).toHaveLength(1);
            expect(response.unlisted[0]).toMatchObject({ item: { id: filler, category: 'Filler' } });
            expect(Date.parse(response.unlisted[0]?.addedAt ?? '')).not.toBeNaN();
        });

        it('lists a watched item unlisted in a league with no data', async () => {
            await watchItem(test.db, alice, await itemId('Divine Orb'));

            const response = await list(alice, { league: 'HC Forbidden Rites' });

            expect(response.rows).toEqual([]);
            expect(response.unlisted.map((entry) => entry.item.name)).toEqual(['Divine Orb']);
        });

        it('answers an unknown league with not found', async () => {
            await expect(list(alice, { league: 'Nowhere' })).rejects.toBeInstanceOf(NotFoundError);
        });

        it("leaves another game's items out, so they are not unlisted in this game's league", async () => {
            const [other] = await insertFiller(1, 'poe1');

            await watchItem(test.db, alice, other ?? 0);

            expect(await list(alice)).toMatchObject({ rows: [], unlisted: [] });
        });

        it('never shows one user the other’s list', async () => {
            await watchItem(test.db, alice, await itemId('Divine Orb'));

            expect((await list(alice)).rows).toHaveLength(1);
            expect(await list(bob)).toMatchObject({ rows: [], unlisted: [] });

            await unwatchItem(test.db, bob, await itemId('Divine Orb'));

            expect((await list(alice)).rows).toHaveLength(1);
        });
    });

    describe('watching and unwatching', () => {
        it('is idempotent both ways', async () => {
            const divine = await itemId('Divine Orb');

            await watchItem(test.db, alice, divine);
            await watchItem(test.db, alice, divine);
            expect(await watchedIds(alice)).toEqual([divine]);

            await unwatchItem(test.db, alice, divine);
            await unwatchItem(test.db, alice, divine);
            expect(await watchedIds(alice)).toEqual([]);
        });

        it('keeps the original added time when watching again', async () => {
            const divine = await itemId('Divine Orb');

            await watchItem(test.db, alice, divine);

            const first = await list(alice);

            await watchItem(test.db, alice, divine);

            expect((await list(alice)).rows[0]?.addedAt).toBe(first.rows[0]?.addedAt);
        });

        it('refuses an unknown item', async () => {
            await expect(watchItem(test.db, alice, 999_999)).rejects.toBeInstanceOf(NotFoundError);
            expect(await watchedIds(alice)).toEqual([]);
        });

        it('does not mind removing an unknown item', async () => {
            await expect(unwatchItem(test.db, alice, 999_999)).resolves.toBeUndefined();
        });

        it('orders the list newest added first among the unlisted', async () => {
            const ids = await insertFiller(3);

            for (const id of ids) await watchItem(test.db, alice, id);

            expect((await list(alice)).unlisted.map((entry) => entry.item.id)).toEqual([...ids].reverse());
        });
    });

    describe('the limit', () => {
        async function fillToLimit(userId: string, leave = 0): Promise<number[]> {
            const ids = await insertFiller(MAX_WATCHLIST_ITEMS);
            const watched = ids.slice(0, MAX_WATCHLIST_ITEMS - leave);

            await test.db
                .insertInto('watchlist_items')
                .values(watched.map((id) => ({ user_id: userId, item_id: id })))
                .execute();

            return ids;
        }

        it('refuses the 101st item, and leaves the list as it was', async () => {
            await fillToLimit(alice);

            await expect(watchItem(test.db, alice, await itemId('Divine Orb'))).rejects.toBeInstanceOf(WatchlistFullError);
            expect(await watchedIds(alice)).toHaveLength(MAX_WATCHLIST_ITEMS);
        });

        it('answers watching an item that is already watched with success, even on a full list', async () => {
            const ids = await fillToLimit(alice);

            await expect(watchItem(test.db, alice, ids[0] ?? 0)).resolves.toBeUndefined();
            expect(await watchedIds(alice)).toHaveLength(MAX_WATCHLIST_ITEMS);
        });

        it('lets one more in after one is removed', async () => {
            const ids = await fillToLimit(alice);
            const divine = await itemId('Divine Orb');

            await unwatchItem(test.db, alice, ids[0] ?? 0);
            await watchItem(test.db, alice, divine);

            expect(await watchedIds(alice)).toHaveLength(MAX_WATCHLIST_ITEMS);
        });

        it('keeps each user’s limit separate', async () => {
            await fillToLimit(alice);
            await expect(watchItem(test.db, bob, await itemId('Divine Orb'))).resolves.toBeUndefined();
        });

        it('lets only one of two concurrent adds at 99 through, leaving 100 and not 101', async () => {
            await fillToLimit(alice, 1);

            // Both ids are resolved and the pool is warm first: a connection still being opened would let the first transaction finish before the second starts.
            await Promise.all(Array.from({ length: 4 }, () => sql`SELECT pg_sleep(0.05)`.execute(test.db)));
            const [divine, exalted] = [await itemId('Divine Orb'), await itemId('Exalted Orb')];
            const results = await Promise.allSettled([watchItem(test.db, alice, divine), watchItem(test.db, alice, exalted)]);

            expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
            expect(results.find((result) => result.status === 'rejected')).toMatchObject({ reason: expect.any(WatchlistFullError) });
            expect(await watchedIds(alice)).toHaveLength(MAX_WATCHLIST_ITEMS);
        });

        it('lets two concurrent adds of the same item both succeed', async () => {
            const divine = await itemId('Divine Orb');
            const results = await Promise.allSettled([watchItem(test.db, alice, divine), watchItem(test.db, alice, divine)]);

            expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled']);
            expect(await watchedIds(alice)).toEqual([divine]);
        });
    });

    describe('getItemRows', () => {
        it('answers an empty id list with the context and nothing else', async () => {
            const result = await getItemRows(test.db, { game: 'poe2', league: 'current', itemIds: [], includeLowConfidence: true, sparkline: true });

            expect(result).toMatchObject({ context: { game: 'poe2', unit: 'exalted' }, rows: [], unlistedIds: [] });
        });

        it('keeps the asked-for order for the ids it has no row for, and leaves sparklines off unless asked', async () => {
            const [first, second] = await insertFiller(2);
            const result = await getItemRows(test.db, {
                game: 'poe2',
                league: 'current',
                itemIds: [second ?? 0, await itemId('Divine Orb'), first ?? 0],
                includeLowConfidence: false,
                sparkline: false,
            });

            expect(result.unlistedIds).toEqual([second, first]);
            expect(result.rows.map((row) => row.item.name)).toEqual(['Divine Orb']);
            expect('sparkline' in (result.rows[0] ?? {})).toBe(false);
        });

        it('leaves getLatest answering as before: rows without sparklines, low confidence only on request, unlisted in request order', async () => {
            const [filler] = await insertFiller(1);
            const items = [filler ?? 0, await itemId('Divine Orb'), await itemId("Winter's Bite")];
            const latest = (includeLowConfidence: boolean) =>
                getLatest(test.db, LatestQuerySchema.parse({ game: 'poe2', items: items.join(','), includeLowConfidence: String(includeLowConfidence) }));

            const strict = await latest(false);

            expect(strict.rows.map((row) => row.item.name)).toEqual(['Divine Orb']);
            expect(strict.unlisted).toEqual([filler, items[2]]);
            expect(strict.rows.every((row) => !('sparkline' in row))).toBe(true);

            const loose = await latest(true);

            expect(loose.rows.map((row) => row.item.name).sort()).toEqual(['Divine Orb', "Winter's Bite"]);
            expect(loose.unlisted).toEqual([filler]);
        });
    });
});
