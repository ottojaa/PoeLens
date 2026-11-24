import { describe, expect, it } from 'vitest';
import { BLOCK_DEFS, BLOCK_TYPES, BLOCK_UPGRADES, type Block, BlockSchema, currentBlockVersion, toDataBlock, upgradeBlock } from './blocks.js';

const SAMPLES: Record<(typeof BLOCK_TYPES)[number], Block> = {
    item: { id: 'i', type: 'item', v: 1, item: 5, name: 'Div', display: 'card' },
    pair: { id: 'p', type: 'pair', v: 1, a: 1, b: 2, name: 'D / E' },
    note: { id: 'n', type: 'note', v: 1, markdown: '# hi' },
    heading: { id: 'h', type: 'heading', v: 1, text: 'Currency' },
};

describe('block registry', () => {
    it('has an entry, a sample and a current schema version for every type', () => {
        for (const type of BLOCK_TYPES) {
            expect(BLOCK_DEFS[type].label).toBeTruthy();
            expect(BlockSchema.safeParse(SAMPLES[type]).success).toBe(true);
            expect(SAMPLES[type].v).toBe(currentBlockVersion(type));
        }
    });

    it('rejects a block of an unknown type or an old version', () => {
        expect(BlockSchema.safeParse({ id: 'x', type: 'table', v: 1 }).success).toBe(false);
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

describe('toDataBlock', () => {
    it('keeps only the data inputs of items and pairs', () => {
        expect(toDataBlock(SAMPLES.item)).toEqual({ id: 'i', type: 'item', item: 5 });
        expect(toDataBlock(SAMPLES.pair)).toEqual({ id: 'p', type: 'pair', a: 1, b: 2 });
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
        expect(upgradeBlock({ type: 'table', v: 1 })).toEqual({ type: 'table', v: 1 });
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
