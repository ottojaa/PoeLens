import {
    DashboardChangedError,
    MAX_BLOCKS,
    MAX_PANELS,
    NotFoundError,
    ValidationError,
    filterRows,
    sortRows,
    type Block,
    type DataBlock,
    type Panel,
    type TableBlockData,
} from '@poelens/shared';
import { sql } from 'kysely';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runCycle } from '../../collector/runtime.js';
import { createPoeNinjaPoe2Adapter } from '../../collector/sources/poe-ninja/poe2.js';
import { createPgCollectorStore } from '../../collector/store-pg.js';
import { seedUser } from '../../testing/auth-helpers.js';
import { FakeNinja } from '../../testing/fake-ninja.js';
import { insertEarlierPrice, insertEarlierRaw, loadItemId, T } from '../../testing/seed-history.js';
import { createTestDatabase, SKIP_DB_TESTS, type TestDatabase } from '../../testing/test-database.js';
import { getTable } from '../prices/index.js';
import { appendBlock, getDashboardData, listDashboards, listTemplates, saveDashboard } from './index.js';
import { toStarterId } from './starter-id.js';

const note = (id: string): Block => ({ id, v: 1, type: 'note', markdown: id });

function panel(id: string, blocks: Panel['blocks'], rect: Partial<Panel> = {}): Panel {
    return { id, title: id, x: 0, y: 0, w: 4, h: 6, hideOnPhone: false, unit: null, blocks, ...rect };
}

describe.skipIf(SKIP_DB_TESTS)('the data blocks and append against PostgreSQL', () => {
    let test: TestDatabase;
    let userId: string;
    let earlier: number;
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
        earlier = await insertEarlierRaw(test.db);

        for (const name of ['Divine Orb', 'Exalted Orb', 'Chaos Orb', 'Orb of Annulment']) ids[name] = await loadItemId(test.db, name);

        userId = await seedUser(test.db, { email: 'alice@example.com' });
    });

    const data = (blocks: DataBlock[], unit: 'auto' | 'divine' | 'exalted' | null = null) =>
        getDashboardData(test.db, { game: 'poe2', league: 'current', panels: [{ unit, blocks }] }, undefined, new Date(T + 5 * 60_000));
    const stored = () => test.db.selectFrom('dashboards').selectAll().where('user_id', '=', userId).orderBy('position').execute();

    describe('table', () => {
        const base = {
            id: 't',
            type: 'table' as const,
            category: 'Currency',
            sort: 'price' as const,
            dir: 'desc' as const,
            q: '',
            minLiquidity: 0,
            hideLowConfidence: true,
            limit: 5,
        };

        it("shows the top rows of the economy view's own sort and filter, and says how many matched", async () => {
            for (const view of [
                { sort: 'price' as const, dir: 'desc' as const, q: '', minLiquidity: 0 },
                { sort: 'name' as const, dir: 'asc' as const, q: 'orb', minLiquidity: 0 },
                { sort: 'liquidity' as const, dir: 'desc' as const, q: '', minLiquidity: 50 },
                { sort: 'h24' as const, dir: 'asc' as const, q: 'of', minLiquidity: 0 },
            ]) {
                const answered = (await data([{ ...base, ...view }])).blocks['t'] as TableBlockData;
                const table = await getTable(test.db, {
                    game: 'poe2',
                    league: 'current',
                    category: 'Currency',
                    unit: 'exalted',
                    includeLowConfidence: false,
                    sparkline: true,
                });
                const expected = sortRows(filterRows(table.rows, view.q, view.minLiquidity), view.sort, view.dir);

                expect(expected.length).toBeGreaterThan(0);
                expect(answered.rows.map((row) => row.item.id)).toEqual(expected.slice(0, 5).map((row) => row.item.id));
                expect(answered.total).toBe(expected.length);
            }
        });

        it("carries each row's sparkline, so the trend column never needs a second request", async () => {
            await insertEarlierPrice(test.db, earlier, ids['Divine Orb']!, 30, { divineFactor: 2 });

            const answered = (await data([{ ...base, q: 'divine' }])).blocks['t'] as TableBlockData;

            expect(answered.rows[0]?.item.name).toBe('Divine Orb');
            expect(answered.rows[0]?.sparkline?.length).toBeGreaterThan(1);
        });

        it('keeps low-confidence rows, flagged, only when told to', async () => {
            await sql`UPDATE prices SET low_confidence = true WHERE item_id = ${ids['Divine Orb']!}`.execute(test.db);

            const hidden = (await data([{ ...base, limit: 50 }])).blocks['t'] as TableBlockData;
            const shown = (await data([{ ...base, limit: 50, hideLowConfidence: false }])).blocks['t'] as TableBlockData;

            expect(hidden.rows.some((row) => row.item.name === 'Divine Orb')).toBe(false);
            expect(shown.rows.find((row) => row.item.name === 'Divine Orb')?.lowConfidence).toBe(true);
        });

        it('prices each panel in its own unit, even for two identical tables', async () => {
            const answered = await getDashboardData(test.db, {
                game: 'poe2',
                league: 'current',
                panels: [
                    { unit: 'divine', blocks: [{ ...base, id: 'a', q: 'divine' }] },
                    { unit: 'chaos', blocks: [{ ...base, id: 'b', q: 'divine' }] },
                ],
            });

            expect((answered.blocks['a'] as TableBlockData).rows[0]).toMatchObject({ unit: 'divine', price: 1 });
            expect((answered.blocks['b'] as TableBlockData).rows[0]).toMatchObject({ unit: 'chaos', price: 13.44 });
        });
    });

    describe('movers and screener', () => {
        beforeEach(async () => {
            await insertEarlierPrice(test.db, earlier, ids['Divine Orb']!, 3, { divineFactor: 1.5 });
            await insertEarlierPrice(test.db, earlier, ids['Exalted Orb']!, 3, { divineFactor: 0.8 });
            await insertEarlierPrice(test.db, earlier, ids['Divine Orb']!, 24, { divineFactor: 1.5 });
            await insertEarlierPrice(test.db, earlier, ids['Exalted Orb']!, 24, { divineFactor: 0.8 });
        });

        const screener = {
            id: 's',
            type: 'screener' as const,
            scope: { categories: ['Currency'] },
            windowHours: 3,
            direction: 'up' as const,
            minChangePct: 20,
            minLiquidity: 0,
            minDivine: null,
            limit: 5,
        };

        it('lists the screener rows with the change over the window', async () => {
            const answered = (await data([screener], 'divine')).blocks['s'];

            expect(answered).toMatchObject({ type: 'screener', unit: 'divine' });
            expect(answered?.type === 'screener' ? answered.rows.map((row) => [row.item.name, row.windowChange]) : []).toEqual([['Divine Orb', 50]]);
        });

        it('ranks under Auto in the default unit but shows each row in the unit it reads best in', async () => {
            const answered = (await data([screener], 'auto')).blocks['s'];

            expect(answered).toMatchObject({ type: 'screener', unit: 'exalted' });
            expect(answered?.type === 'screener' ? answered.rows[0] : null).toMatchObject({ item: { name: 'Divine Orb' }, windowChange: 50 });
        });

        it('answers the movers of a scope in their window', async () => {
            const answered = (await data([{ id: 'm', type: 'movers', scope: { categories: ['Currency'] }, window: '24h', limit: 3 }], 'divine')).blocks['m'];

            expect(answered?.type === 'movers' ? answered.risers[0]?.item.name : null).toBe('Divine Orb');
            expect(answered?.type === 'movers' ? answered.fallers[0]?.item.name : null).toBe('Exalted Orb');
        });
    });

    describe('chart', () => {
        it('draws an item in the panel unit, and a pair as one divided by the other', async () => {
            await insertEarlierPrice(test.db, earlier, ids['Divine Orb']!, 2, { divineFactor: 2 });
            await insertEarlierPrice(test.db, earlier, ids['Exalted Orb']!, 2, { divineFactor: 4 });

            const answered = await data(
                [
                    { id: 'c', type: 'chart', item: ids['Divine Orb']!, quote: null, range: '24h' },
                    { id: 'p', type: 'chart', item: ids['Divine Orb']!, quote: ids['Exalted Orb']!, range: '24h' },
                ],
                'exalted',
            );
            const single = answered.blocks['c'];
            const pair = answered.blocks['p'];

            expect(single).toMatchObject({ type: 'chart', unit: 'exalted', quote: null, item: { name: 'Divine Orb' } });
            expect(pair).toMatchObject({ type: 'chart', unit: null, quote: { name: 'Exalted Orb' } });
            expect(pair?.type === 'chart' ? pair.points.length : 0).toBe(2);
        });

        it('answers an item the catalog no longer has as null, and starts a league range at the league', async () => {
            const answered = await data([
                { id: 'gone', type: 'chart', item: 2_000_000, quote: null, range: '7d' },
                { id: 'league', type: 'chart', item: ids['Divine Orb']!, quote: null, range: 'league' },
            ]);

            expect(answered.blocks['gone']).toBeNull();
            expect(answered.blocks['league']).toMatchObject({ type: 'chart' });
        });
    });

    describe('appending a block', () => {
        const table: Block = {
            id: 'client',
            v: 1,
            type: 'table',
            category: 'Currency',
            sort: 'price',
            dir: 'desc',
            q: '',
            minLiquidity: 0,
            hideLowConfidence: true,
            columns: [],
            limit: 10,
        };

        it('puts it in a new panel on the starter, stores the starter and bumps the revision', async () => {
            const id = toStarterId(userId, 'poe2');
            const added = await appendBlock(test.db, userId, id, { block: table, title: 'Currency' });
            const [row] = await stored();

            expect(added.revision).toBe(1);
            expect(added.blockId).not.toBe('client');
            expect(row).toMatchObject({ id, revision: 1 });

            const dashboard = (await listDashboards(test.db, userId, 'poe2')).dashboards[0]!;
            const created = dashboard.panels.find((candidate) => candidate.id === added.panelId);

            expect(dashboard.revision).toBe(1);
            expect(created).toMatchObject({ title: 'Currency', x: 0, unit: null });
            expect(created?.blocks).toEqual([{ ...table, id: added.blockId }]);
            expect(dashboard.panels.length).toBeGreaterThan(1);
            expect(created!.y).toBeGreaterThanOrEqual(Math.max(...dashboard.panels.filter((other) => other !== created).map((other) => other.y + other.h)));
        });

        it('adds to an existing panel, last, and keeps every other block as it was', async () => {
            const id = toStarterId(userId, 'poe2');
            const saved = await saveDashboard(test.db, userId, id, {
                revision: 0,
                name: 'Trading',
                panels: [panel('a', [note('n1')]), panel('b', [note('n2')], { x: 4 })],
            });
            const added = await appendBlock(test.db, userId, id, { block: table, panelId: 'b' });
            const after = (await listDashboards(test.db, userId, 'poe2')).dashboards[0]!;

            expect(added).toMatchObject({ panelId: 'b', revision: saved.revision + 1 });
            expect(after.panels.find((candidate) => candidate.id === 'b')?.blocks.map((block) => block.id)).toEqual(['n2', added.blockId]);
            expect(after.panels.find((candidate) => candidate.id === 'a')?.blocks).toEqual([note('n1')]);
        });

        it('makes an editor on the old revision learn of it: its save is a 409 carrying the dashboard with the block', async () => {
            const id = toStarterId(userId, 'poe2');
            const saved = await saveDashboard(test.db, userId, id, { revision: 0, name: 'Trading', panels: [panel('a', [note('n1')])] });

            await appendBlock(test.db, userId, id, { block: table, panelId: 'a' });

            const stale = saveDashboard(test.db, userId, id, { revision: saved.revision, name: 'Trading', panels: [panel('a', [note('n1'), note('n3')])] });

            await expect(stale).rejects.toBeInstanceOf(DashboardChangedError);
            await expect(stale).rejects.toMatchObject({ statusCode: 409, details: { current: { revision: saved.revision + 1 } } });
        });

        it('gives two appends of the same block different ids, and two revisions', async () => {
            const id = toStarterId(userId, 'poe2');
            const first = await appendBlock(test.db, userId, id, { block: table });
            const second = await appendBlock(test.db, userId, id, { block: table });

            expect(second.revision).toBe(first.revision + 1);
            expect(second.blockId).not.toBe(first.blockId);
            expect(second.panelId).not.toBe(first.panelId);
        });

        it("refuses an unknown panel, a full panel, a full dashboard, other categories, other items and someone else's dashboard", async () => {
            const id = toStarterId(userId, 'poe2');
            const full = Array.from({ length: MAX_BLOCKS }, (_, index) => note('f' + index));
            const crowded = Array.from({ length: MAX_PANELS }, (_, index) =>
                panel('p' + index, [], { x: (index % 3) * 4, y: Math.floor(index / 3) * 2, w: 4, h: 2 }),
            );

            await saveDashboard(test.db, userId, id, { revision: 0, name: 'Trading', panels: [panel('full', full)] });
            await expect(appendBlock(test.db, userId, id, { block: table, panelId: 'nope' })).rejects.toBeInstanceOf(NotFoundError);
            await expect(appendBlock(test.db, userId, id, { block: table, panelId: 'full' })).rejects.toBeInstanceOf(ValidationError);
            await expect(appendBlock(test.db, userId, id, { block: { ...table, category: 'Nothing' } })).rejects.toMatchObject({
                details: { categories: ['Nothing'] },
            });
            await expect(
                appendBlock(test.db, userId, id, { block: { id: 'c', v: 1, type: 'chart', item: 2_000_000, quote: null, range: '7d' } }),
            ).rejects.toMatchObject({
                details: { itemIds: [2_000_000] },
            });
            await saveDashboard(test.db, userId, id, { revision: 1, name: 'Trading', panels: crowded });
            await expect(appendBlock(test.db, userId, id, { block: table })).rejects.toBeInstanceOf(ValidationError);

            const other = await seedUser(test.db, { email: 'bob@example.com' });

            await expect(appendBlock(test.db, other, id, { block: table })).rejects.toBeInstanceOf(NotFoundError);
            expect((await stored())[0]?.revision).toBe(2);
        });

        it('keeps every append when many arrive at once', async () => {
            const id = toStarterId(userId, 'poe2');
            const results = await Promise.all(Array.from({ length: 6 }, () => appendBlock(test.db, userId, id, { block: table })));
            const after = (await listDashboards(test.db, userId, 'poe2')).dashboards[0]!;

            expect(results.map((result) => result.revision).sort()).toEqual([1, 2, 3, 4, 5, 6]);
            expect(results.every((result) => after.panels.some((candidate) => candidate.id === result.panelId))).toBe(true);
        });
    });

    describe('templates', () => {
        const catalog = async (names: string[]) => {
            for (const name of names) {
                const { id } = await test.db
                    .insertInto('items')
                    .values({ game: 'poe2', name, base_type: null, category: 'UniqueAccessories', icon: null })
                    .returning('id')
                    .executeTakeFirstOrThrow();

                ids[name] = id;
            }
        };

        it("has the five templates with the design's descriptions, in order", async () => {
            const { templates } = await listTemplates(test.db, 'poe2');

            expect(templates.map((template) => [template.name, template.description])).toEqual([
                ['Currency rates', '3 pairs, an item and a note'],
                ['Chase uniques', 'A heading, 2 item cards and a price chart'],
                ['Rising fast', 'A screener: +20% in 3 h, 50+ listings, 1+ div'],
                ['Useful links', 'A note with your links'],
                ['Blank', 'An empty panel. Add blocks yourself.'],
            ]);
        });

        it("points at the catalog's real item ids", async () => {
            await catalog(['Headhunter', 'Original Sin']);

            const { templates } = await listTemplates(test.db, 'poe2');
            const rates = templates.find((template) => template.id === 'currency-rates')!.panel;
            const chase = templates.find((template) => template.id === 'chase-uniques')!.panel;

            expect(rates.blocks.filter((block) => block.type === 'pair').map((block) => (block.type === 'pair' ? [block.a, block.b] : []))).toEqual([
                [ids['Divine Orb'], ids['Exalted Orb']],
                [ids['Divine Orb'], ids['Chaos Orb']],
                [ids['Orb of Annulment'], ids['Exalted Orb']],
            ]);
            expect(chase.blocks.map((block) => block.type)).toEqual(['heading', 'item', 'item', 'chart']);
            expect(chase.blocks.filter((block) => block.type === 'item').map((block) => (block.type === 'item' ? [block.item, block.display] : []))).toEqual([
                [ids['Headhunter'], 'card'],
                [ids['Original Sin'], 'card'],
            ]);
            expect(chase.blocks[3]).toMatchObject({ type: 'chart', item: ids['Original Sin'], quote: null });
        });

        it('leaves out the items the catalog does not have', async () => {
            await catalog(['Headhunter']);

            const chase = (await listTemplates(test.db, 'poe2')).templates.find((template) => template.id === 'chase-uniques')!.panel;

            expect(chase.blocks.map((block) => block.type)).toEqual(['heading', 'item', 'chart']);
        });

        it('has the rising rule as drawn, and a panel that saves as is', async () => {
            const { templates } = await listTemplates(test.db, 'poe2');
            const rising = templates.find((template) => template.id === 'rising-fast')!.panel;

            expect(rising.blocks[0]).toMatchObject({ type: 'screener', windowHours: 3, minChangePct: 20, minLiquidity: 50, minDivine: 1, direction: 'up' });

            let revision = 0;

            for (const template of templates) {
                const id = toStarterId(userId, 'poe2');
                const saved = await saveDashboard(test.db, userId, id, { revision, name: 'Trading', panels: [{ ...template.panel, x: 0, y: 0 }] });

                revision = saved.revision;
            }

            expect(revision).toBe(5);
        });
    });
});
