import { z } from 'zod';
import { blockBase, BlockIdSchema, blockName, ItemIdSchema, MAX_HEADING_LENGTH, MAX_NOTE_LENGTH } from './block-base.js';
import {
    ChartBlockSchema,
    ChartDataBlockSchema,
    MoversBlockSchema,
    MoversDataBlockSchema,
    ScreenerBlockSchema,
    ScreenerDataBlockSchema,
    TableBlockSchema,
    TableDataBlockSchema,
} from './block-settings.js';
import { MAX_BLOCKS } from './limits.js';

export const ITEM_DISPLAYS = ['compact', 'card'] as const;
export const ItemDisplaySchema = z.enum(ITEM_DISPLAYS);

export const ItemBlockSchema = z.object({
    ...blockBase,
    type: z.literal('item'),
    item: ItemIdSchema,
    /** Replaces the item's name when set. */
    name: blockName,
    display: ItemDisplaySchema.default('compact'),
});

/** `a` priced in `b`: how many of `b` one `a` buys. */
export const PairBlockSchema = z.object({
    ...blockBase,
    type: z.literal('pair'),
    a: ItemIdSchema,
    b: ItemIdSchema,
    /** Replaces "A / B" when set. */
    name: blockName,
});

/** Markdown, without raw HTML or images (the viewer drops both). */
export const NoteBlockSchema = z.object({
    ...blockBase,
    type: z.literal('note'),
    markdown: z.string().max(MAX_NOTE_LENGTH),
});

/** A section title; an empty one is a plain divider. */
export const HeadingBlockSchema = z.object({
    ...blockBase,
    type: z.literal('heading'),
    text: z.string().trim().max(MAX_HEADING_LENGTH),
});

export const BlockSchema = z.discriminatedUnion('type', [
    ItemBlockSchema,
    PairBlockSchema,
    NoteBlockSchema,
    HeadingBlockSchema,
    TableBlockSchema,
    MoversBlockSchema,
    ScreenerBlockSchema,
    ChartBlockSchema,
]);

export const BlocksSchema = z.array(BlockSchema).max(MAX_BLOCKS);

export type ItemBlock = z.infer<typeof ItemBlockSchema>;
export type PairBlock = z.infer<typeof PairBlockSchema>;
export type NoteBlock = z.infer<typeof NoteBlockSchema>;
export type HeadingBlock = z.infer<typeof HeadingBlockSchema>;
export type { TableBlock, MoversBlock, ScreenerBlock, ChartBlock } from './block-settings.js';
export type Block = z.infer<typeof BlockSchema>;
export type BlockType = Block['type'];

export const BLOCK_TYPES = BlockSchema.options.map((option) => option.shape.type.value);

// The inputs a block's data depends on, and nothing else: the request body and the page's query key are built from
// these, so typing in a note or renaming a block never refetches.

export const ItemDataBlockSchema = z.object({ id: BlockIdSchema, type: z.literal('item'), item: ItemIdSchema });
export const PairDataBlockSchema = z.object({ id: BlockIdSchema, type: z.literal('pair'), a: ItemIdSchema, b: ItemIdSchema });

export const DataBlockSchema = z.discriminatedUnion('type', [
    ItemDataBlockSchema,
    PairDataBlockSchema,
    TableDataBlockSchema,
    MoversDataBlockSchema,
    ScreenerDataBlockSchema,
    ChartDataBlockSchema,
]);

export type DataBlock = z.infer<typeof DataBlockSchema>;
export type DataBlockType = DataBlock['type'];

type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;

interface BlockDef<T extends BlockType> {
    /** What the add-block menu calls it. */
    label: string;
    /** The data inputs of a block, or null when the block shows no data (notes, headings). */
    dataKey: (block: BlockOf<T>) => DataBlock | null;
}

/** Everything a block type needs, in one place. A new type that is missing from here fails the typecheck. */
export const BLOCK_DEFS: { [T in BlockType]: BlockDef<T> } = {
    item: { label: 'Item', dataKey: ({ id, item }) => ({ id, type: 'item', item }) },
    pair: { label: 'Pair', dataKey: ({ id, a, b }) => ({ id, type: 'pair', a, b }) },
    note: { label: 'Note', dataKey: () => null },
    heading: { label: 'Heading', dataKey: () => null },
    table: {
        label: 'Price table',
        dataKey: ({ id, category, sort, dir, q, minLiquidity, hideLowConfidence, limit }) => ({
            id,
            type: 'table',
            category,
            sort,
            dir,
            q,
            minLiquidity,
            hideLowConfidence,
            limit,
        }),
    },
    movers: { label: 'Movers', dataKey: ({ id, scope, window, limit }) => ({ id, type: 'movers', scope, window, limit }) },
    screener: {
        label: 'Screener',
        dataKey: ({ id, scope, windowHours, direction, minChangePct, minLiquidity, minDivine, limit }) => ({
            id,
            type: 'screener',
            scope,
            windowHours,
            direction,
            minChangePct,
            minLiquidity,
            minDivine,
            limit,
        }),
    },
    chart: { label: 'Price chart', dataKey: ({ id, item, quote, range }) => ({ id, type: 'chart', item, quote, range }) },
};

/** The data inputs of a block, or null for a block that shows no data. */
export function toDataBlock(block: Block): DataBlock | null {
    // TypeScript can't correlate `block.type` with its own entry in the registry, so the call is widened here.
    const def = BLOCK_DEFS[block.type] as BlockDef<BlockType>;

    return def.dataKey(block);
}

type BlockUpgrade = (block: Record<string, unknown>) => Record<string, unknown>;

/**
 * Steps that bring an older stored block to the current shape. `BLOCK_UPGRADES[type][n]` turns version `n + 1` into
 * version `n + 2`, so a type's current version is its list's length plus one. Adding an optional setting needs no
 * entry (give the schema a `.default()`); changing or removing one adds an entry and bumps `v` in the schema.
 */
export const BLOCK_UPGRADES: Record<BlockType, BlockUpgrade[]> = {
    item: [],
    pair: [],
    note: [],
    heading: [],
    table: [],
    movers: [],
    screener: [],
    chart: [],
};

export function currentBlockVersion(type: BlockType): number {
    return BLOCK_UPGRADES[type].length + 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isBlockType(value: unknown): value is BlockType {
    return BLOCK_TYPES.some((type) => type === value);
}

/** Runs a stored block through its upgrade steps; anything that isn't a known block comes back unchanged to fail validation. */
export function upgradeBlock(raw: unknown): unknown {
    if (!isRecord(raw) || !isBlockType(raw.type)) return raw;

    if (typeof raw.v !== 'number' || !Number.isInteger(raw.v) || raw.v < 1) return raw;

    if (raw.v > currentBlockVersion(raw.type)) return raw;

    const upgraded = BLOCK_UPGRADES[raw.type].slice(raw.v - 1).reduce((block, step) => step(block), raw);

    return { ...upgraded, v: currentBlockVersion(raw.type) };
}

/** Upgrades every block of stored panels (any JSON), so old stored shapes parse as the current ones. */
export function upgradePanels(raw: unknown): unknown {
    if (!Array.isArray(raw)) return raw;

    return raw.map((panel: unknown) => {
        if (!isRecord(panel) || !Array.isArray(panel.blocks)) return panel;

        return { ...panel, blocks: panel.blocks.map(upgradeBlock) };
    });
}
