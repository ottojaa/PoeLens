import { DashboardChangedError, DashboardsFullError, MAX_DASHBOARDS, NotFoundError, ValidationError, type Panel } from '@poelens/shared';
import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runCycle } from '../../collector/runtime.js';
import { createPoeNinjaPoe2Adapter } from '../../collector/sources/poe-ninja/poe2.js';
import { createPgCollectorStore } from '../../collector/store-pg.js';
import { seedUser } from '../../testing/auth-helpers.js';
import { FakeNinja } from '../../testing/fake-ninja.js';
import { createTestDatabase, SKIP_DB_TESTS, type TestDatabase } from '../../testing/test-database.js';
import { createDashboard, deleteDashboard, getDashboardData, listDashboards, reorderDashboards, saveDashboard } from './index.js';
import { toStarterId } from './starter-id.js';

const T = Date.UTC(2026, 10, 23, 12, 0, 0);
const HOUR = 3_600_000;

function panel(id: string, blocks: Panel['blocks'], rect: Partial<Panel> = {}): Panel {
    return { id, title: id, x: 0, y: 0, w: 4, h: 6, hideOnPhone: false, unit: null, blocks, ...rect };
}

describe.skipIf(SKIP_DB_TESTS)('dashboards against PostgreSQL', () => {
    let test: TestDatabase;
    let userId: string;
    let otherId: string;
    const ids: Record<string, number> = {};

    beforeAll(async () => {
        test = await createTestDatabase();
    });

    afterAll(async () => {
        await test.close();
    });

    beforeEach(async () => {
        await sql`TRUNCATE prices, item_keys, items, raw_responses, collector_runs, leagues, dashboards, users RESTART IDENTITY CASCADE`.execute(test.db);
        await runCycle({
            adapter: createPoeNinjaPoe2Adapter({ leagues: ['Forbidden Rites'] }),
            store: createPgCollectorStore(test.db),
            fetcher: new FakeNinja(),
            now: () => new Date(T),
        });

        for (const name of ['Divine Orb', 'Exalted Orb', 'Chaos Orb', 'Orb of Annulment']) {
            ids[name] = (await test.db.selectFrom('items').select('id').where('name', '=', name).executeTakeFirstOrThrow()).id;
        }

        userId = await seedUser(test.db, { email: 'alice@example.com' });
        otherId = await seedUser(test.db, { email: 'bob@example.com' });
    });

    const rows = () => test.db.selectFrom('dashboards').selectAll().where('user_id', '=', userId).orderBy('position').execute();
    const item = (id: string, itemId: number) => ({ id, v: 1 as const, type: 'item' as const, item: itemId, display: 'compact' as const });

    describe('the starter', () => {
        it('is a Trading dashboard at revision 0 with a fixed id, and reading stores nothing', async () => {
            const first = await listDashboards(test.db, userId, 'poe2');
            const second = await listDashboards(test.db, userId, 'poe2');

            expect(first.dashboards).toHaveLength(1);
            expect(first.dashboards[0]).toMatchObject({ id: toStarterId(userId, 'poe2'), name: 'Trading', position: 0, revision: 0 });
            expect(second.dashboards[0]?.id).toBe(first.dashboards[0]?.id);
            expect(await rows()).toEqual([]);
            expect(toStarterId(otherId, 'poe2')).not.toBe(toStarterId(userId, 'poe2'));
        });

        it('has the Currency rates and Useful links panels, leaving out items the catalog does not have', async () => {
            const [starter] = (await listDashboards(test.db, userId, 'poe2')).dashboards;
            const rates = starter?.panels.find((candidate) => candidate.title === 'Currency rates');
            const links = starter?.panels.find((candidate) => candidate.title === 'Useful links');

            expect(rates?.blocks.filter((block) => block.type === 'pair').map((block) => (block.type === 'pair' ? [block.a, block.b] : []))).toEqual([
                [ids['Divine Orb'], ids['Exalted Orb']],
                [ids['Divine Orb'], ids['Chaos Orb']],
                [ids['Orb of Annulment'], ids['Exalted Orb']],
            ]);
            expect(rates?.blocks.some((block) => block.type === 'item')).toBe(false);
            expect(links?.blocks[0]).toMatchObject({ type: 'note' });
        });

        it('stores one row at revision 1 on its first save, and refuses a second tab still on revision 0', async () => {
            const id = toStarterId(userId, 'poe2');
            const saved = await saveDashboard(test.db, userId, id, { revision: 0, name: 'Trading', panels: [panel('p1', [item('b1', ids['Divine Orb']!)])] });

            expect(saved).toMatchObject({ id, revision: 1 });
            expect(await rows()).toHaveLength(1);

            const stale = saveDashboard(test.db, userId, id, { revision: 0, name: 'Other', panels: [] });

            await expect(stale).rejects.toBeInstanceOf(DashboardChangedError);
            await expect(stale).rejects.toMatchObject({
                statusCode: 409,
                code: 'DASHBOARD_CHANGED',
                details: { current: { id, revision: 1, name: 'Trading' } },
            });
            expect(await rows()).toHaveLength(1);
        });

        it('lets two tabs race the first save: one wins, one is refused, one row', async () => {
            const id = toStarterId(userId, 'poe2');
            const save = (name: string) => saveDashboard(test.db, userId, id, { revision: 0, name, panels: [] });
            const results = await Promise.allSettled([save('A'), save('B')]);

            expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
            expect(await rows()).toHaveLength(1);
        });

        it('stays when a tab is added: Trading and the new tab are both there after a reload', async () => {
            const created = await createDashboard(test.db, userId, { game: 'poe2', name: 'Leveling' });
            const { dashboards } = await listDashboards(test.db, userId, 'poe2');

            expect(created).toMatchObject({ name: 'Leveling', position: 1, revision: 1, panels: [] });
            expect(dashboards.map((dashboard) => [dashboard.name, dashboard.position])).toEqual([
                ['Trading', 0],
                ['Leveling', 1],
            ]);
            expect(dashboards[0]).toMatchObject({ id: toStarterId(userId, 'poe2'), revision: 0 });
        });

        it('comes back after the last dashboard is deleted', async () => {
            const { id } = await createDashboard(test.db, userId, { game: 'poe2', name: 'Leveling' });

            await deleteDashboard(test.db, userId, id);
            await deleteDashboard(test.db, userId, toStarterId(userId, 'poe2'));

            expect(await rows()).toEqual([]);
            expect((await listDashboards(test.db, userId, 'poe2')).dashboards[0]).toMatchObject({ id: toStarterId(userId, 'poe2'), revision: 0 });
        });
    });

    describe('saving', () => {
        it('lays panels out without overlaps', async () => {
            const { id } = await createDashboard(test.db, userId, { game: 'poe2', name: 'Leveling' });
            const saved = await saveDashboard(test.db, userId, id, { revision: 1, name: 'Leveling', panels: [panel('a', []), panel('b', [])] });
            const [a, b] = saved.panels;

            expect(a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h).toBe(false);
        });

        it('refuses items that are not in the dashboards game, and says which', async () => {
            const { id } = await createDashboard(test.db, userId, { game: 'poe2', name: 'Leveling' });
            const save = saveDashboard(test.db, userId, id, { revision: 1, name: 'Leveling', panels: [panel('a', [item('b1', 2_000_000)])] });

            await expect(save).rejects.toBeInstanceOf(ValidationError);
            await expect(save).rejects.toMatchObject({ details: { itemIds: [2_000_000] } });
        });

        it("answers not found for someone else's dashboard or an unknown id, and changes nothing", async () => {
            const { id } = await createDashboard(test.db, otherId, { game: 'poe2', name: 'Bobs' });
            const body = { revision: 1, name: 'Mine now', panels: [] };

            await expect(saveDashboard(test.db, userId, id, body)).rejects.toBeInstanceOf(NotFoundError);
            await expect(saveDashboard(test.db, userId, crypto.randomUUID(), body)).rejects.toBeInstanceOf(NotFoundError);
            await expect(deleteDashboard(test.db, userId, id)).rejects.toBeInstanceOf(NotFoundError);
            expect((await test.db.selectFrom('dashboards').select('name').where('id', '=', id).executeTakeFirstOrThrow()).name).toBe('Bobs');
        });

        it('stores panels as a JSON array, not a Postgres array', async () => {
            const { id } = await createDashboard(test.db, userId, { game: 'poe2', name: 'Leveling' });

            await saveDashboard(test.db, userId, id, { revision: 1, name: 'Leveling', panels: [panel('a', [])] });

            const { rows: stored } = await sql<{ type: string }>`SELECT jsonb_typeof(panels) AS type FROM dashboards WHERE id = ${id}`.execute(test.db);

            expect(stored[0]?.type).toBe('array');
        });
    });

    describe('limits and order', () => {
        it('keeps ten dashboards per game, even when many are added at once', async () => {
            const results = await Promise.allSettled(
                Array.from({ length: 14 }, (_, index) => createDashboard(test.db, userId, { game: 'poe2', name: 'Tab ' + index })),
            );
            const refused = results.filter((result) => result.status === 'rejected');

            expect(await rows()).toHaveLength(MAX_DASHBOARDS);
            expect(refused).toHaveLength(5);
            expect(refused.every((result) => result.reason instanceof DashboardsFullError)).toBe(true);
            expect((await rows()).map((row) => row.position)).toEqual([...Array(MAX_DASHBOARDS).keys()]);
        });

        it('keeps the limit per game', async () => {
            await createDashboard(test.db, userId, { game: 'poe2', name: 'A' });

            expect((await createDashboard(test.db, userId, { game: 'poe1', name: 'B' })).position).toBe(1);
        });

        it('closes the gap when a tab is deleted', async () => {
            const a = await createDashboard(test.db, userId, { game: 'poe2', name: 'A' });
            await createDashboard(test.db, userId, { game: 'poe2', name: 'B' });
            await deleteDashboard(test.db, userId, a.id);

            expect((await rows()).map((row) => [row.name, row.position])).toEqual([
                ['Trading', 0],
                ['B', 1],
            ]);
        });

        it('reorders tabs, and refuses a list that is not exactly the dashboards', async () => {
            const a = await createDashboard(test.db, userId, { game: 'poe2', name: 'A' });
            const starter = toStarterId(userId, 'poe2');

            await reorderDashboards(test.db, userId, { game: 'poe2', ids: [a.id, starter] });
            expect((await rows()).map((row) => row.name)).toEqual(['A', 'Trading']);
            await expect(reorderDashboards(test.db, userId, { game: 'poe2', ids: [a.id] })).rejects.toBeInstanceOf(ValidationError);
            await expect(reorderDashboards(test.db, userId, { game: 'poe2', ids: [a.id, a.id] })).rejects.toBeInstanceOf(ValidationError);
            await expect(reorderDashboards(test.db, userId, { game: 'poe2', ids: [a.id, crypto.randomUUID()] })).rejects.toBeInstanceOf(ValidationError);
        });
    });

    describe('data', () => {
        const data = (panels: Parameters<typeof getDashboardData>[1]['panels'], unit?: 'auto' | 'divine') =>
            getDashboardData(test.db, { game: 'poe2', league: 'current', ...(unit && { unit }), panels });

        it('prices item blocks in their panel unit, and leaves a missing item null', async () => {
            const answered = await data([
                { unit: 'chaos', blocks: [{ id: 'a', type: 'item', item: ids['Divine Orb']! }] },
                {
                    unit: null,
                    blocks: [
                        { id: 'b', type: 'item', item: ids['Divine Orb']! },
                        { id: 'c', type: 'item', item: 2_000_000 },
                    ],
                },
            ]);

            expect(answered.unit).toBe('exalted');
            expect(answered.blocks['a']).toMatchObject({ type: 'item', row: { unit: 'chaos', price: 13.44 } });
            expect(answered.blocks['b']).toMatchObject({ type: 'item', row: { unit: 'exalted', price: 445.9 } });
            expect(answered.blocks['c']).toBeNull();
        });

        it('answers an item with no price as the item and no row', async () => {
            await sql`DELETE FROM prices WHERE item_id = ${ids['Chaos Orb']!}`.execute(test.db);

            const answered = await data([{ unit: null, blocks: [{ id: 'a', type: 'item', item: ids['Chaos Orb']! }] }]);

            expect(answered.blocks['a']).toMatchObject({ type: 'item', item: { id: ids['Chaos Orb'] }, row: null });
        });

        it('rates a pair in divine whatever unit the panel is in', async () => {
            const answered = await data([{ unit: 'chaos', blocks: [{ id: 'p', type: 'pair', a: ids['Divine Orb']!, b: ids['Exalted Orb']! }] }]);
            const pair = answered.blocks['p'];

            expect(pair).toMatchObject({ type: 'pair', lowConfidence: false });
            expect(pair?.type === 'pair' ? pair.price : null).toBeCloseTo(445.9, 0);
        });

        it('measures a pair change in divine, so Auto does not flatten it to zero', async () => {
            const earlier = await test.db
                .insertInto('raw_responses')
                .values({
                    source: 'poe.ninja',
                    game: 'poe2',
                    kind: 'exchange',
                    league: 'Forbidden Rites',
                    category: 'Currency',
                    url: 'https://example.test/earlier',
                    fetched_at: new Date(T - 8 * 24 * HOUR),
                    status: 200,
                    etag: null,
                    sha256: 'earlier',
                    body: Buffer.alloc(0),
                    parser_version: 1,
                })
                .returning('id')
                .executeTakeFirstOrThrow();
            const insertPoint = (itemId: number, divine: number) =>
                test.db
                    .insertInto('prices')
                    .values({
                        time: new Date(T - 24 * HOUR),
                        game: 'poe2',
                        league: 'Forbidden Rites',
                        item_id: itemId,
                        source: 'poe.ninja',
                        divine,
                        exalted: 445.9 * divine,
                        chaos: 13.44 * divine,
                        listings: null,
                        volume: 1,
                        low_confidence: false,
                        raw_id: earlier.id,
                    })
                    .execute();

            // A day ago Divine cost half what it does now (+100%) and Exalted cost twice as much (-50%): Divine/Exalted rose 300%.
            const exaltedNow = await test.db.selectFrom('prices').select('divine').where('item_id', '=', ids['Exalted Orb']!).executeTakeFirstOrThrow();

            await insertPoint(ids['Divine Orb']!, 0.5);
            await insertPoint(ids['Exalted Orb']!, 2 * exaltedNow.divine);

            const answered = await data([{ unit: null, blocks: [{ id: 'p', type: 'pair', a: ids['Divine Orb']!, b: ids['Exalted Orb']! }] }], 'auto');

            expect(answered.blocks['p']).toMatchObject({ type: 'pair', h24: 300 });
        });

        it('flags a pair when a side has low confidence, and has a sparkline of shared days only', async () => {
            await sql`UPDATE prices SET low_confidence = true WHERE item_id = ${ids['Exalted Orb']!}`.execute(test.db);

            const answered = await data([{ unit: null, blocks: [{ id: 'p', type: 'pair', a: ids['Divine Orb']!, b: ids['Exalted Orb']! }] }]);

            expect(answered.blocks['p']).toMatchObject({ type: 'pair', lowConfidence: true, sparkline: [] });
        });
    });
});
