import { describe, expect, it } from 'vitest';
import type { LeagueRecord } from '../../types.js';
import { createPoeNinjaPoe2Adapter } from './poe2.js';

const BASE = 'https://poe.ninja/poe2/api/economy';

// The requests the collector has always made, written out so a change to the category list cannot alter them unseen.
const EXCHANGE_TYPES = [
    'Currency',
    'Fragments',
    'Abyss',
    'UncutGems',
    'LineageSupportGems',
    'Essences',
    'SoulCores',
    'Idols',
    'Runes',
    'Ritual',
    'Expedition',
    'Delirium',
    'Breach',
    'Verisium',
];

const STASH_TYPES = [
    'UniqueWeapons',
    'UniqueArmours',
    'UniqueAccessories',
    'UniqueFlasks',
    'UniqueCharms',
    'UniqueJewels',
    'UniqueSanctumRelics',
    'UniqueTablets',
    'PrecursorTablets',
];

const LEAGUE: LeagueRecord = { name: 'Forbidden Rites', hardcore: false, current: true };

describe('poe.ninja PoE 2 request plan', () => {
    it('requests every exchange category, then every stash category, with unchanged URLs', () => {
        const adapter = createPoeNinjaPoe2Adapter();
        const urls = adapter.plan([LEAGUE]).map((request) => request.url);

        const expected = [
            ...EXCHANGE_TYPES.map((type) => `${BASE}/exchange/current/overview?league=Forbidden+Rites&type=${type}`),
            ...STASH_TYPES.map((type) => `${BASE}/stash/current/item/overview?league=Forbidden+Rites&type=${type}`),
        ];

        expect(urls).toEqual(expected);
    });

    it('labels each request with its kind and category', () => {
        const adapter = createPoeNinjaPoe2Adapter();
        const requests = adapter.plan([LEAGUE]).map((request) => [request.kind, request.category]);

        expect(requests).toEqual([...EXCHANGE_TYPES.map((type) => ['exchange', type]), ...STASH_TYPES.map((type) => ['stash', type])]);
    });
});
