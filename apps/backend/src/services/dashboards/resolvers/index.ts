import type { DataBlockType } from '@poelens/shared';
import { resolveCharts } from './chart.js';
import { resolveItems } from './item.js';
import { resolveMovers } from './movers.js';
import { resolvePairs } from './pair.js';
import { resolveScreeners } from './screener.js';
import { resolveTables } from './table.js';
import type { Resolver } from './types.js';

/** One resolver per data-bearing block type; the mapped type makes a new type a compile error until it has one. */
export const RESOLVERS: { [T in DataBlockType]: Resolver<T> } = {
    item: resolveItems,
    pair: resolvePairs,
    table: resolveTables,
    movers: resolveMovers,
    screener: resolveScreeners,
    chart: resolveCharts,
};
