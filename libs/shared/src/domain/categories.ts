import type { Game } from './game.js';

/** Which poe.ninja endpoint serves a category: the currency exchange, or the stash item overview. */
export type CategoryEndpoint = 'exchange' | 'stash';

/** How the clients group categories in navigation. It carries no data meaning. */
export type CategoryGroup = 'economy' | 'uniques';

export interface Category {
    /** poe.ninja's `type` query value; also the stable key clients use for the category. */
    id: string;
    label: string;
    endpoint: CategoryEndpoint;
    group: CategoryGroup;
}

export const CATEGORY_GROUP_LABELS: Record<CategoryGroup, string> = {
    economy: 'Economy',
    uniques: 'Uniques',
};

/**
 * Every price category per game, in the order the collector requests them: the exchange endpoint's first, then the
 * stash endpoint's. Only PoE 2 is filled in; PoE 1 arrives with its own collector.
 */
export const CATEGORIES: Record<Game, readonly Category[]> = {
    poe2: [
        { id: 'Currency', label: 'Currency', endpoint: 'exchange', group: 'economy' },
        { id: 'Fragments', label: 'Fragments', endpoint: 'exchange', group: 'economy' },
        { id: 'Abyss', label: 'Abyss', endpoint: 'exchange', group: 'economy' },
        { id: 'UncutGems', label: 'Uncut gems', endpoint: 'exchange', group: 'economy' },
        { id: 'LineageSupportGems', label: 'Lineage support gems', endpoint: 'exchange', group: 'economy' },
        { id: 'Essences', label: 'Essences', endpoint: 'exchange', group: 'economy' },
        { id: 'SoulCores', label: 'Soul cores', endpoint: 'exchange', group: 'economy' },
        { id: 'Idols', label: 'Idols', endpoint: 'exchange', group: 'economy' },
        { id: 'Runes', label: 'Runes', endpoint: 'exchange', group: 'economy' },
        { id: 'Ritual', label: 'Ritual', endpoint: 'exchange', group: 'economy' },
        { id: 'Expedition', label: 'Expedition', endpoint: 'exchange', group: 'economy' },
        { id: 'Delirium', label: 'Delirium', endpoint: 'exchange', group: 'economy' },
        { id: 'Breach', label: 'Breach', endpoint: 'exchange', group: 'economy' },
        { id: 'Verisium', label: 'Verisium', endpoint: 'exchange', group: 'economy' },
        { id: 'UniqueWeapons', label: 'Unique weapons', endpoint: 'stash', group: 'uniques' },
        { id: 'UniqueArmours', label: 'Unique armour', endpoint: 'stash', group: 'uniques' },
        { id: 'UniqueAccessories', label: 'Unique accessories', endpoint: 'stash', group: 'uniques' },
        { id: 'UniqueFlasks', label: 'Unique flasks', endpoint: 'stash', group: 'uniques' },
        { id: 'UniqueCharms', label: 'Unique charms', endpoint: 'stash', group: 'uniques' },
        { id: 'UniqueJewels', label: 'Unique jewels', endpoint: 'stash', group: 'uniques' },
        { id: 'UniqueSanctumRelics', label: 'Unique sanctum relics', endpoint: 'stash', group: 'uniques' },
        { id: 'UniqueTablets', label: 'Unique tablets', endpoint: 'stash', group: 'uniques' },
        // Served by the stash endpoint, but they are not uniques.
        { id: 'PrecursorTablets', label: 'Precursor tablets', endpoint: 'stash', group: 'economy' },
    ],
    poe1: [],
};

/** A game's categories on one endpoint, in list order. */
export function categoriesOnEndpoint(game: Game, endpoint: CategoryEndpoint): Category[] {
    return CATEGORIES[game].filter((category) => category.endpoint === endpoint);
}
