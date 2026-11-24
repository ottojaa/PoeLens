import {
    HistoryResponseSchema,
    LatestResponseSchema,
    LeaguesResponseSchema,
    SearchResponseSchema,
    TableResponseSchema,
    type Game,
    type HistoryBucket,
    type Unit,
} from '@poelens/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchApi } from './client';

/** Prices change about hourly (PoE 2), so the open page checks for new ones every five minutes, and when the window regains focus. */
export const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const LEAGUES_STALE_MS = 60 * 60 * 1000;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) if (value !== undefined) query.set(key, String(value));

    return '?' + query.toString();
}

/** What every price query is scoped to: the game, the league (`'current'` or a name) and the unit the prices are in. */
export interface PriceScope {
    game: Game;
    league: string;
    unit: Unit;
}

export function useLeagues(game: Game) {
    return useQuery({
        queryKey: ['leagues', game],
        queryFn: () => fetchApi('/prices/leagues' + toQuery({ game }), LeaguesResponseSchema),
        staleTime: LEAGUES_STALE_MS,
    });
}

/** One category with a sparkline per row. Keeps the old rows on screen while a new league, unit or filter loads. */
export function useTable(scope: PriceScope, category: string, includeLowConfidence: boolean) {
    return useQuery({
        queryKey: ['table', scope.game, scope.league, scope.unit, category, includeLowConfidence],
        queryFn: () => fetchApi('/prices/table' + toQuery({ ...scope, category, includeLowConfidence, sparkline: true }), TableResponseSchema),
        placeholderData: keepPreviousData,
        refetchInterval: REFRESH_INTERVAL_MS,
    });
}

/** The latest price of up to `MAX_LATEST_ITEMS` items, low-confidence ones included (they come back flagged). */
export function useLatest(scope: PriceScope, items: readonly number[], options: { refresh?: boolean } = {}) {
    return useQuery({
        queryKey: ['latest', scope.game, scope.league, scope.unit, items.join(',')],
        queryFn: () => fetchApi('/prices/latest' + toQuery({ ...scope, items: items.join(','), includeLowConfidence: true }), LatestResponseSchema),
        enabled: items.length > 0,
        placeholderData: keepPreviousData,
        refetchInterval: options.refresh ? REFRESH_INTERVAL_MS : false,
    });
}

export const RANGE_SPANS = {
    '24h': { bucket: 'hour', spanMs: DAY_MS },
    '7d': { bucket: 'hour', spanMs: 7 * DAY_MS },
    '30d': { bucket: 'day', spanMs: 30 * DAY_MS },
} as const satisfies Record<string, { bucket: HistoryBucket; spanMs: number }>;

export type HistoryRange = keyof typeof RANGE_SPANS | 'league';

/** The bucket and start of a history range. "League" is daily from the league's first sighting. */
export function toHistoryWindow(range: HistoryRange, leagueFirstSeen: string | undefined, now: Date): { bucket: HistoryBucket; from: string } | null {
    if (range === 'league') {
        if (!leagueFirstSeen) return null;

        return { bucket: 'day', from: leagueFirstSeen };
    }

    const { bucket, spanMs } = RANGE_SPANS[range];

    return { bucket, from: new Date(now.getTime() - spanMs).toISOString() };
}

/**
 * One item's price series over a range. The start is computed when the request is sent, not in the query key, so the
 * key does not change every render. Confident prices only, like every series.
 */
export function useHistory(scope: PriceScope, item: number, range: HistoryRange, leagueFirstSeen: string | undefined) {
    const enabled = range !== 'league' || leagueFirstSeen !== undefined;

    return useQuery({
        queryKey: ['history', scope.game, scope.league, scope.unit, item, range, leagueFirstSeen],
        queryFn: () => {
            const window = toHistoryWindow(range, leagueFirstSeen, new Date());

            return fetchApi('/prices/history' + toQuery({ ...scope, item, bucket: window?.bucket, from: window?.from }), HistoryResponseSchema);
        },
        enabled,
        placeholderData: keepPreviousData,
        refetchInterval: REFRESH_INTERVAL_MS,
    });
}

export const SEARCH_MIN_LENGTH = 2;

export function usePriceSearch(game: Game, text: string) {
    return useQuery({
        queryKey: ['search', game, text],
        queryFn: () => fetchApi('/prices/search' + toQuery({ game, q: text, limit: 8 }), SearchResponseSchema),
        enabled: text.length >= SEARCH_MIN_LENGTH,
        placeholderData: keepPreviousData,
        staleTime: 60_000,
    });
}
