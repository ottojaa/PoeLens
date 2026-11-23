import type { LeagueRecord, ParsedFacts, RequestKey, RequestSpec, SourceAdapter } from '../../types.js';
import { ParseError } from '../../types.js';
import { parseExchange, parseLeagues, parseStash } from './parse.js';

export const POE_NINJA_SOURCE = 'poe.ninja';

const BASE_URL = 'https://poe.ninja/poe2/api/economy';

/** Bumped when `parse` changes what it produces. */
const PARSER_VERSION = 1;

export const POE2_EXCHANGE_TYPES = [
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
] as const;

export const POE2_STASH_TYPES = [
    'UniqueWeapons',
    'UniqueArmours',
    'UniqueAccessories',
    'UniqueFlasks',
    'UniqueCharms',
    'UniqueJewels',
    'UniqueSanctumRelics',
    'UniqueTablets',
    'PrecursorTablets',
] as const;

export interface PoeNinjaPoe2Options {
    /** League names to collect. Empty means the current challenge league and its hardcore version. */
    leagues?: string[];
}

function exchangeRequest(league: string, type: string): RequestSpec {
    const query = new URLSearchParams({ league, type });

    return { kind: 'exchange', league, category: type, url: `${BASE_URL}/exchange/current/overview?${query}` };
}

function stashRequest(league: string, type: string): RequestSpec {
    const query = new URLSearchParams({ league, type });

    return { kind: 'stash', league, category: type, url: `${BASE_URL}/stash/current/item/overview?${query}` };
}

export function createPoeNinjaPoe2Adapter(options: PoeNinjaPoe2Options = {}): SourceAdapter {
    const selected = options.leagues ?? [];

    function pickLeagues(known: LeagueRecord[]): string[] {
        if (selected.length) return known.filter((league) => selected.includes(league.name)).map((league) => league.name);

        return known.filter((league) => league.current).map((league) => league.name);
    }

    return {
        source: POE_NINJA_SOURCE,
        game: 'poe2',
        parserVersion: PARSER_VERSION,

        discover: () => ({ kind: 'leagues', league: '', category: '', url: `${BASE_URL}/leagues` }),

        plan: (known) =>
            pickLeagues(known).flatMap((league) => [
                ...POE2_EXCHANGE_TYPES.map((type) => exchangeRequest(league, type)),
                ...POE2_STASH_TYPES.map((type) => stashRequest(league, type)),
            ]),

        parse(key: RequestKey, body: string): ParsedFacts {
            if (key.kind === 'leagues') return parseLeagues(body);

            if (key.kind === 'exchange') return parseExchange(key.category, body);

            if (key.kind === 'stash') return parseStash(key.category, body);

            throw new ParseError('Unknown request kind: ' + key.kind);
        },
    };
}
