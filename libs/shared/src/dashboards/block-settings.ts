import { z } from 'zod';
import { MoverWindowSchema } from '../api/schemas/prices.js';
import { DEFAULT_COLUMNS, OPTIONAL_COLUMNS, SORT_KEYS } from '../economy/columns.js';
import { HISTORY_RANGES } from '../economy/history-range.js';
import { blockBase, blockName, ItemIdSchema } from './block-base.js';
import { ScopeSchema } from './scope.js';

/** The most rows a price table block shows, and the most a movers or screener block shows per list. */
export const MAX_TABLE_ROWS = 50;
export const MAX_LIST_ROWS = 20;

/** The longest a screener's window can be: a week. */
export const MAX_SCREENER_HOURS = 168;

const listLimit = z.number().int().min(1).max(MAX_LIST_ROWS);

/** A category with the economy view's own filter, sort and columns, cut to its top rows. */
export const TableBlockSchema = z.object({
    ...blockBase,
    type: z.literal('table'),
    name: blockName,
    category: z.string().min(1).max(60),
    sort: z.enum(SORT_KEYS).default('price'),
    dir: z.enum(['asc', 'desc']).default('desc'),
    q: z.string().trim().max(100).default(''),
    minLiquidity: z.number().min(0).max(1_000_000_000).default(0),
    hideLowConfidence: z.boolean().default(true),
    columns: z
        .array(z.enum(OPTIONAL_COLUMNS))
        .max(OPTIONAL_COLUMNS.length)
        .default([...DEFAULT_COLUMNS]),
    limit: z.number().int().min(1).max(MAX_TABLE_ROWS).default(10),
});

/** The biggest risers and fallers of a group of categories over a window. */
export const MoversBlockSchema = z.object({
    ...blockBase,
    type: z.literal('movers'),
    name: blockName,
    scope: ScopeSchema.default({ group: 'all' }),
    window: MoverWindowSchema.default('24h'),
    limit: listLimit.default(3),
});

/** Items whose price moved by at least `minChangePct` percent, up or down, over the last `windowHours` hours. */
export const ScreenerBlockSchema = z.object({
    ...blockBase,
    type: z.literal('screener'),
    name: blockName,
    scope: ScopeSchema.default({ group: 'all' }),
    windowHours: z.number().int().min(1).max(MAX_SCREENER_HOURS).default(3),
    direction: z.enum(['up', 'down']).default('up'),
    /** A magnitude: 20 means "20% or more", in the direction chosen. */
    minChangePct: z.number().min(0).max(100_000).default(20),
    /** The fewest listings (or, for exchange items, the lowest traded value in divine) an item needs. */
    minLiquidity: z.number().min(0).max(1_000_000_000).default(50),
    /** The least an item is worth, in divine; null for no floor. */
    minDivine: z.number().min(0).max(1_000_000_000).nullable().default(1),
    limit: listLimit.default(5),
});

/** One item's price history, or a pair's (the item priced in `quote`). */
export const ChartBlockSchema = z.object({
    ...blockBase,
    type: z.literal('chart'),
    name: blockName,
    item: ItemIdSchema,
    quote: ItemIdSchema.nullable().default(null),
    range: z.enum(HISTORY_RANGES).default('7d'),
});

export type TableBlock = z.infer<typeof TableBlockSchema>;
export type MoversBlock = z.infer<typeof MoversBlockSchema>;
export type ScreenerBlock = z.infer<typeof ScreenerBlockSchema>;
export type ChartBlock = z.infer<typeof ChartBlockSchema>;

// The inputs each block's data depends on, and nothing else (see `BLOCK_DEFS`). A table's columns are left out: the
// resolver always sends the sparkline, so showing or hiding a column never refetches.

export const TableDataBlockSchema = TableBlockSchema.omit({ v: true, name: true, columns: true });
export const MoversDataBlockSchema = MoversBlockSchema.omit({ v: true, name: true });
export const ScreenerDataBlockSchema = ScreenerBlockSchema.omit({ v: true, name: true });
export const ChartDataBlockSchema = ChartBlockSchema.omit({ v: true, name: true });

export type ChartDataBlock = z.infer<typeof ChartDataBlockSchema>;
