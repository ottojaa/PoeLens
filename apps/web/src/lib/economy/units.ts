import { DEFAULT_UNIT, UnitSchema, type Game, type Unit } from '@poelens/shared';

/** What a unit is called in a price: "1.5 div". */
export const UNIT_SHORT: Record<Unit, string> = { divine: 'div', exalted: 'ex', chaos: 'c' };

const STORAGE_KEY = 'poelens.unit';

/** The unit the viewer picked last in this browser, if any. Storage can be missing or full, so it never throws. */
export function loadStoredUnit(): Unit | undefined {
    try {
        const parsed = UnitSchema.safeParse(window.localStorage.getItem(STORAGE_KEY));

        return parsed.success ? parsed.data : undefined;
    } catch {
        return undefined;
    }
}

export function storeUnit(unit: Unit): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, unit);
    } catch {
        // A browser that refuses storage just forgets the choice on the next visit.
    }
}

/** The unit to show: the URL's, else the browser's stored choice, else the game's default. */
export function resolveUnit(fromUrl: Unit | undefined, stored: Unit | undefined, game: Game): Unit {
    return fromUrl ?? stored ?? DEFAULT_UNIT[game];
}
