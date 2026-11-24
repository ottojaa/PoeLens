import { UnitChoiceSchema, type Unit, type UnitChoice } from '@poelens/shared';

/** What a unit is called in running text and on buttons. */
export const UNIT_LABEL: Record<Unit, string> = { divine: 'Divine', exalted: 'Exalted', chaos: 'Chaos' };

/** What a unit is called in a price: "1.5 div". */
export const UNIT_SHORT: Record<Unit, string> = { divine: 'div', exalted: 'ex', chaos: 'c' };

const STORAGE_KEY = 'poelens.unit';

/** The unit choice the viewer made last in this browser, if any. Storage can be missing or full, so it never throws. */
export function loadStoredUnit(): UnitChoice | undefined {
    try {
        const parsed = UnitChoiceSchema.safeParse(window.localStorage.getItem(STORAGE_KEY));

        return parsed.success ? parsed.data : undefined;
    } catch {
        return undefined;
    }
}

export function storeUnit(unit: UnitChoice): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, unit);
    } catch {
        // A browser that refuses storage just forgets the choice on the next visit.
    }
}

/** The choice to show: the URL's, else the browser's stored one, else Auto. */
export function resolveUnit(fromUrl: UnitChoice | undefined, stored: UnitChoice | undefined): UnitChoice {
    return fromUrl ?? stored ?? 'auto';
}
