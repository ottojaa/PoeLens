import type { Unit } from '@poelens/shared';
import { useCurrencyRows, type PriceScope } from '@/lib/api/prices';

/** The currency item each unit is counted in, found by name among the Currency rows. */
const UNIT_ITEM_NAME: Record<Unit, string> = { divine: 'Divine Orb', exalted: 'Exalted Orb', chaos: 'Chaos Orb' };

/** The id of the currency item a unit is counted in; undefined until the Currency rows are there. */
export function useUnitItemId(scope: PriceScope, unit: Unit): number | undefined {
    const rows = useCurrencyRows(scope).data?.rows;

    return rows?.find((row) => row.item.name === UNIT_ITEM_NAME[unit])?.item.id;
}
