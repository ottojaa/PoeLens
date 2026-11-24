import { HISTORY_RANGES, UnitChoiceSchema } from '@poelens/shared';
import { z } from 'zod';
import { DEFAULT_COLUMNS, DEFAULT_SORT, OPTIONAL_COLUMNS, SORT_KEYS, type OptionalColumn, type SortDirection, type SortKey } from './columns';

/*
 * Search params are typed by what is in the URL, which is never trusted: every field falls back to "absent" on a
 * garbage value, so a hand-edited or stale link opens the default view instead of an error page. The router has already
 * JSON-decoded each value (`q=123` arrives as a number, `min=abc` as a string), and the schemas accept that.
 */

export const RANGES = HISTORY_RANGES;
export type Range = (typeof RANGES)[number];
export const DEFAULT_RANGE: Range = '7d';

const NO_COLUMNS = 'none';

/** League and unit, on every page: carried across navigation by the root route. */
const RootSearchSchema = z.object({
    league: z.string().min(1).optional().catch(undefined),
    unit: UnitChoiceSchema.optional().catch(undefined),
});

const EconomySearchSchema = z.object({
    sort: z.enum(SORT_KEYS).optional().catch(undefined),
    dir: z.enum(['asc', 'desc']).optional().catch(undefined),
    q: z.union([z.string(), z.number(), z.boolean()]).transform(String).optional().catch(undefined),
    min: z.number().nonnegative().finite().optional().catch(undefined),
    hideLow: z.boolean().optional().catch(undefined),
    cols: z.string().optional().catch(undefined),
});

const ItemSearchSchema = z.object({
    range: z.enum(RANGES).optional().catch(undefined),
});

export type RootSearch = z.infer<typeof RootSearchSchema>;
export type EconomySearch = z.infer<typeof EconomySearchSchema>;
export type ItemSearch = z.infer<typeof ItemSearchSchema>;

export function parseRootSearch(input: Record<string, unknown>): RootSearch {
    return RootSearchSchema.parse(input);
}

export function parseEconomySearch(input: Record<string, unknown>): EconomySearch {
    return EconomySearchSchema.parse(input);
}

export function parseItemSearch(input: Record<string, unknown>): ItemSearch {
    return ItemSearchSchema.parse(input);
}

/** The economy view's state with every default applied. */
export interface EconomyView {
    sort: SortKey;
    dir: SortDirection;
    q: string;
    min: number;
    hideLow: boolean;
    columns: readonly OptionalColumn[];
}

export function toEconomyView(search: EconomySearch): EconomyView {
    return {
        sort: search.sort ?? DEFAULT_SORT.sort,
        dir: search.dir ?? DEFAULT_SORT.dir,
        q: search.q?.trim() ?? '',
        min: search.min ?? 0,
        hideLow: search.hideLow ?? true,
        columns: parseColumns(search.cols),
    };
}

/** `cols` is a comma list in the table's column order; `none` is no optional column; anything unreadable is the default. */
export function parseColumns(value: string | undefined): readonly OptionalColumn[] {
    if (value === undefined) return DEFAULT_COLUMNS;

    if (value === NO_COLUMNS) return [];

    const wanted = new Set(value.split(','));
    const known = OPTIONAL_COLUMNS.filter((column) => wanted.has(column));

    return known.length ? known : DEFAULT_COLUMNS;
}

/** The URL form of the visible columns, or undefined when they are the default (a default view keeps a clean URL). */
export function toColumnsParam(columns: readonly OptionalColumn[]): string | undefined {
    const ordered = OPTIONAL_COLUMNS.filter((column) => columns.includes(column));

    if (ordered.join() === DEFAULT_COLUMNS.join()) return undefined;

    return ordered.length ? ordered.join(',') : NO_COLUMNS;
}

export function toRange(search: ItemSearch): Range {
    return search.range ?? DEFAULT_RANGE;
}
