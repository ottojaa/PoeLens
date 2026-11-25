import {
    HistoryResponseSchema,
    LatestResponseSchema,
    LeaguesResponseSchema,
    SearchResponseSchema,
    TableResponseSchema,
    type Game,
    toHistoryWindow,
    type HistoryRange,
    type UnitChoice,
} from '@poelens/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchApi } from './client';

/** Prices change about hourly (PoE 2), so the open page checks for new ones every five minutes, and when the window regains focus. */
export const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const LEAGUES_STALE_MS = 60 * 60 * 1000;

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) if (value !== undefined) query.set(key, String(value));

    return '?' + query.toString();
}

/** What every price query is scoped to: the game, the league (`'current'` or a name) and the unit choice: `auto` puts each row in the unit its price reads best in. */
export interface PriceScope {
    game: Game;
    league: string;
    unit: UnitChoice;
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

/** The Currency category without sparklines, in the game's default unit: its Divine Orb row's `prices` are the exchange rates between units. */
export function useCurrencyRows(scope: PriceScope) {
    return useQuery({
        queryKey: ['currency-rows', scope.game, scope.league],
        queryFn: () =>
            fetchApi('/prices/table' + toQuery({ ...scope, unit: 'exalted', category: 'Currency', includeLowConfidence: true }), TableResponseSchema),
        // No placeholder: another league's rates would sit in this league's meta line until its own arrive.
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

export { toHistoryWindow, type HistoryRange } from '@poelens/shared';

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
