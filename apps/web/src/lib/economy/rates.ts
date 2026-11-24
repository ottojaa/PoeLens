import type { PriceRow } from '@poelens/shared';
import { formatPrice } from '@/lib/format';

/** What one divine is worth in the other two currencies. */
export interface Rates {
    exalted: number;
    chaos: number;
}

/** The orb the divine unit is named after, as the Currency category lists it. */
const DIVINE_ITEM_NAME = 'Divine Orb';

function toDivinePrice(rows: readonly PriceRow[] | undefined): number | undefined {
    return rows?.find((row) => row.item.name === DIVINE_ITEM_NAME)?.price;
}

/**
 * One divine in exalted and in chaos: the Divine Orb's own price in a Currency table asked for in each. Reading the
 * price directly keeps it equal to the one on the item page; dividing the other orbs' prices drifts in the fourth digit.
 * Undefined until both tables are in and list the orb.
 */
export function toRates(inExalted: readonly PriceRow[] | undefined, inChaos: readonly PriceRow[] | undefined): Rates | undefined {
    const exalted = toDivinePrice(inExalted);
    const chaos = toDivinePrice(inChaos);

    if (exalted === undefined || chaos === undefined) return undefined;

    return { exalted, chaos };
}

/** "1 div = 450.2 ex = 13.42 c". */
export function formatRates(rates: Rates): string {
    return `1 div = ${formatPrice(rates.exalted)} ex = ${formatPrice(rates.chaos)} c`;
}
