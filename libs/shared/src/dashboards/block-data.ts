import { z } from 'zod';
import { HistoryPointSchema, ItemRefSchema, PriceRowSchema, TableRowSchema } from '../api/schemas/prices.js';
import { UnitSchema } from '../domain/units.js';

export const TableBlockDataSchema = z.object({
    type: z.literal('table'),
    /** The top rows, sorted and filtered as the economy view does, each with its sparkline. */
    rows: z.array(TableRowSchema),
    /** How many rows matched the filter before the block's limit cut them. */
    total: z.number().int().min(0),
});

export const MoversBlockDataSchema = z.object({
    type: z.literal('movers'),
    /** The unit the lists are ranked in; each row still reads in the unit that suits it under Auto. */
    unit: UnitSchema,
    risers: z.array(PriceRowSchema),
    fallers: z.array(PriceRowSchema),
});

export const ScreenerRowSchema = PriceRowSchema.extend({
    /** The change over the block's window, in percent, in the ranking unit. */
    windowChange: z.number(),
});

export const ScreenerBlockDataSchema = z.object({
    type: z.literal('screener'),
    unit: UnitSchema,
    rows: z.array(ScreenerRowSchema),
});

export const ChartBlockDataSchema = z.object({
    type: z.literal('chart'),
    item: ItemRefSchema,
    /** The item the price is quoted in, for a pair chart. */
    quote: ItemRefSchema.nullable(),
    /** The unit the points are in; null for a pair chart, whose points are how many `quote` one `item` buys. */
    unit: UnitSchema.nullable(),
    points: z.array(HistoryPointSchema),
});

export type TableBlockData = z.infer<typeof TableBlockDataSchema>;
export type MoversBlockData = z.infer<typeof MoversBlockDataSchema>;
export type ScreenerRow = z.infer<typeof ScreenerRowSchema>;
export type ScreenerBlockData = z.infer<typeof ScreenerBlockDataSchema>;
export type ChartBlockData = z.infer<typeof ChartBlockDataSchema>;
