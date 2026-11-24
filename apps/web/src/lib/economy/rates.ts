import type { PriceRow, Prices } from '@poelens/shared';
import { formatPrice } from '@/lib/format';

/** The orb the divine unit is named after, as the Currency category lists it. */
const DIVINE_ITEM_NAME = 'Divine Orb';

/**
 * One divine in every unit: the Divine Orb row's own `prices` in a Currency table. Reading the row directly keeps the
 * rates equal to the ones on the item page; dividing the other orbs' prices drifts in the fourth digit. Undefined until
 * the table is in and lists the orb.
 */
export function toRates(rows: readonly PriceRow[] | undefined): Prices | undefined {
    return rows?.find((row) => row.item.name === DIVINE_ITEM_NAME)?.prices;
}

/** "1 div = 450.2 ex = 13.42 c". */
export function formatRates(rates: Prices): string {
    return `1 div = ${formatPrice(rates.exalted)} ex = ${formatPrice(rates.chaos)} c`;
}
