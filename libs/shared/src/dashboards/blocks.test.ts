import { describe, expect, it } from 'vitest';
import { BLOCK_DEFS, BLOCK_TYPES, BLOCK_UPGRADES, type Block, BlockSchema, currentBlockVersion, toDataBlock, upgradeBlock } from './blocks.js';

const SAMPLES = {
    item: { id: 'i', type: 'item', v: 1, item: 5, name: 'Div', display: 'card' },
    pair: { id: 'p', type: 'pair', v: 1, a: 1, b: 2, name: 'D / E' },
    note: { id: 'n', type: 'note', v: 1, markdown: '# hi' },
    heading: { id: 'h', type: 'heading', v: 1, text: 'Currency' },
    table: {
        id: 't',
        type: 'table',
        v: 1,
        category: 'UniqueArmours',
        sort: 'd7',
        dir: 'desc',
        q: 'robe',
        minLiquidity: 20,
        hideLowConfidence: true,
        columns: ['d7', 'trend'],
        limit: 6,
    },
    movers: { id: 'm', type: 'movers', v: 1, scope: { group: 'uniques' }, window: '24h', limit: 3 },
    screener: {
        id: 's',
        type: 'screener',
        v: 1,
        scope: { categories: ['UniqueWeapons'] },
        windowHours: 3,
        direction: 'up',
        minChangePct: 20,
        minLiquidity: 50,
        minDivine: 1,
        limit: 5,
    },
    chart: { id: 'c', type: 'chart', v: 1, item: 5, quote: null, range: '7d' },
} satisfies Record<(typeof BLOCK_TYPES)[number], Block>;

describe('block registry', () => {
    it('has an entry, a sample and a current schema version for every type', () => {
        for (const type of BLOCK_TYPES) {
            expect(BLOCK_DEFS[type].label).toBeTruthy();
            expect(BlockSchema.safeParse(SAMPLES[type]).success).toBe(true);
            expect(SAMPLES[type].v).toBe(currentBlockVersion(type));
        }
    });

    it('rejects a block of an unknown type or an old version', () => {
        expect(BlockSchema.safeParse({ id: 'x', type: 'gauge', v: 1 }).success).toBe(false);
        expect(BlockSchema.safeParse({ ...SAMPLES.note, v: 2 }).success).toBe(false);
    });

    it('defaults an item block to the compact display', () => {
        const parsed = BlockSchema.parse({ id: 'i', type: 'item', v: 1, item: 5 });

        expect(parsed).toMatchObject({ display: 'compact' });
    });

    it('limits an item id to what the database holds', () => {
        expect(BlockSchema.safeParse({ ...SAMPLES.item, item: 2_147_483_648 }).success).toBe(false);
        expect(BlockSchema.safeParse({ ...SAMPLES.item, item: 0 }).success).toBe(false);
    });

    it('limits note and heading text', () => {
        expect(BlockSchema.safeParse({ ...SAMPLES.note, markdown: 'x'.repeat(4001) }).success).toBe(false);
        expect(BlockSchema.safeParse({ ...SAMPLES.heading, text: 'x'.repeat(81) }).success).toBe(false);
        expect(BlockSchema.safeParse({ ...SAMPLES.heading, text: '' }).success).toBe(true);
    });
});

describe('the data blocks', () => {
    it('default every setting of a block saved without it', () => {
        expect(BlockSchema.parse({ id: 'm', type: 'movers', v: 1 })).toMatchObject({ scope: { group: 'all' }, window: '24h', limit: 3 });
        expect(BlockSchema.parse({ id: 's', type: 'screener', v: 1 })).toMatchObject({
            windowHours: 3,
            direction: 'up',
            minChangePct: 20,
            minLiquidity: 50,
            minDivine: 1,
            limit: 5,
        });
        expect(BlockSchema.parse({ id: 'c', type: 'chart', v: 1, item: 4 })).toMatchObject({ quote: null, range: '7d' });
        expect(BlockSchema.parse({ id: 't', type: 'table', v: 1, category: 'Currency' })).toMatchObject({
            sort: 'price',
            dir: 'desc',
            q: '',
            minLiquidity: 0,
            hideLowConfidence: true,
            columns: ['h24', 'd7', 'trend', 'liquidity'],
            limit: 10,
        });
    });

    it('keeps each list within its cap', () => {
        expect(BlockSchema.safeParse({ ...SAMPLES.table, limit: 51 }).success).toBe(false);
        expect(BlockSchema.safeParse({ ...SAMPLES.table, limit: 0 }).success).toBe(false);
        expect(BlockSchema.safeParse({ ...SAMPLES.movers, limit: 21 }).success).toBe(false);
        expect(BlockSchema.safeParse({ ...SAMPLES.screener, limit: 21 }).success).toBe(false);
        expect(BlockSchema.safeParse({ ...SAMPLES.screener, windowHours: 169 }).success).toBe(false);
        expect(BlockSchema.safeParse({ ...SAMPLES.screener, windowHours: 0 }).success).toBe(false);
        expect(BlockSchema.safeParse({ ...SAMPLES.screener, windowHours: 1.5 }).success).toBe(false);
    });

    it('takes a screener with no floor in divine, and a scope that is a group or a list', () => {
        expect(BlockSchema.safeParse({ ...SAMPLES.screener, minDivine: null }).success).toBe(true);
        expect(BlockSchema.safeParse({ ...SAMPLES.movers, scope: { group: 'everything' } }).success).toBe(false);
        expect(BlockSchema.safeParse({ ...SAMPLES.movers, scope: { categories: [] } }).success).toBe(false);
    });

    it('takes only the four chart ranges', () => {
        expect(BlockSchema.safeParse({ ...SAMPLES.chart, range: '90d' }).success).toBe(false);
        expect(BlockSchema.safeParse({ ...SAMPLES.chart, range: 'league', quote: 7 }).success).toBe(true);
    });
});

describe('toDataBlock', () => {
    it('keeps only the data inputs of items and pairs', () => {
        expect(toDataBlock(SAMPLES.item)).toEqual({ id: 'i', type: 'item', item: 5 });
        expect(toDataBlock(SAMPLES.pair)).toEqual({ id: 'p', type: 'pair', a: 1, b: 2 });
    });

    it('keeps the data inputs of the other blocks, without their display names', () => {
        expect(toDataBlock({ ...SAMPLES.chart, name: 'Mine' })).toEqual({ id: 'c', type: 'chart', item: 5, quote: null, range: '7d' });
        expect(toDataBlock(SAMPLES.movers)).toEqual({ id: 'm', type: 'movers', scope: { group: 'uniques' }, window: '24h', limit: 3 });
        expect(toDataBlock({ ...SAMPLES.screener, name: 'Mine' })).toEqual({
            id: 's',
            type: 'screener',
            scope: { categories: ['UniqueWeapons'] },
            windowHours: 3,
            direction: 'up',
            minChangePct: 20,
            minLiquidity: 50,
            minDivine: 1,
            limit: 5,
        });
    });

    it('leaves a table\'s columns out: showing a column never refetches', () => {
        const data = toDataBlock({ ...SAMPLES.table, name: 'Mine' });
        const withColumns = toDataBlock({ ...SAMPLES.table, columns: ['h1'] });

        expect(data).toEqual(withColumns);
        expect(data).toEqual({
            id: 't',
            type: 'table',
            category: 'UniqueArmours',
            sort: 'd7',
            dir: 'desc',
            q: 'robe',
            minLiquidity: 20,
            hideLowConfidence: true,
            limit: 6,
        });
    });

    it('gives notes and headings no data', () => {
        expect(toDataBlock(SAMPLES.note)).toBeNull();
        expect(toDataBlock(SAMPLES.heading)).toBeNull();
    });
});

describe('upgradeBlock', () => {
    it('passes a current block through', () => {
        expect(upgradeBlock(SAMPLES.pair)).toEqual(SAMPLES.pair);
    });

    it('returns anything that is not a known block unchanged', () => {
        expect(upgradeBlock(null)).toBeNull();
        expect(upgradeBlock({ type: 'gauge', v: 1 })).toEqual({ type: 'gauge', v: 1 });
        expect(upgradeBlock({ type: 'note' })).toEqual({ type: 'note' });
    });

    it('does not claim a newer block as current', () => {
        expect(upgradeBlock({ ...SAMPLES.note, v: 9 })).toEqual({ ...SAMPLES.note, v: 9 });
    });

    it('runs the upgrade steps from the stored version', () => {
        const original = BLOCK_UPGRADES.note;

        BLOCK_UPGRADES.note = [(block) => ({ ...block, markdown: String(block.text) })];

        try {
            expect(upgradeBlock({ id: 'n', type: 'note', v: 1, text: 'old' })).toEqual({ id: 'n', type: 'note', v: 2, text: 'old', markdown: 'old' });
            expect(upgradeBlock({ id: 'n', type: 'note', v: 2, markdown: 'new' })).toEqual({ id: 'n', type: 'note', v: 2, markdown: 'new' });
        } finally {
            BLOCK_UPGRADES.note = original;
        }
    });
});
