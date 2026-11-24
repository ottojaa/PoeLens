import { WATCHLIST_FULL_CODE, WatchlistResponseSchema, type ItemRef, type Unit, type WatchlistRow, type WatchlistUnlisted } from '@poelens/shared';
import { keepPreviousData, useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { useEconomyContext } from '@/lib/economy/use-economy-context';
import type { WatchControls } from '@/lib/watchlist/controls';
import { isFullList, toWantedStates, toWatchedIds, withoutPendingRemovals, type PendingToggle } from '@/lib/watchlist/overlay';
import { toToggleErrorMessage } from '@/lib/watchlist/messages';
import { ApiError, fetchApi, sendApi } from './client';
import { REFRESH_INTERVAL_MS, type PriceScope } from './prices';

const TOGGLE_KEY = ['watchlist', 'toggle'] as const;
const ERROR_TOAST_ID = 'watchlist-error';

function toQuery(scope: PriceScope): string {
    return '?' + new URLSearchParams({ game: scope.game, league: scope.league, unit: scope.unit }).toString();
}

/** The signed-in user's watched items in the page's league and unit, priced. Keeps the old answer on screen while a new scope loads. */
function useWatchlistQuery(scope: PriceScope) {
    return useQuery({
        queryKey: ['watchlist', scope.game, scope.league, scope.unit],
        queryFn: () => fetchApi('/watchlist' + toQuery(scope), WatchlistResponseSchema),
        placeholderData: keepPreviousData,
        refetchInterval: REFRESH_INTERVAL_MS,
    });
}

/** The toggles that are on their way to the server, waiting their turn included. */
function usePendingToggles(): PendingToggle[] {
    return useMutationState({
        filters: { mutationKey: TOGGLE_KEY, status: 'pending' },
        select: (mutation) => mutation.state.variables as PendingToggle,
    });
}

export interface Watchlist {
    /** Priced watched items, most valuable first, without the ones being removed. */
    rows: WatchlistRow[];
    /** Watched items with no price in this league, newest first, without the ones being removed. */
    unlisted: WatchlistUnlisted[];
    /** How many items are watched, as the user sees it now (pending toggles included). */
    count: number;
    isFull: boolean;
    isWatched: (itemId: number) => boolean;
    /** Asks for the item to be (un)watched: sends the state wanted, so a double-click or two tabs end in the same state. */
    setWatched: (item: Pick<ItemRef, 'id'>, watched: boolean) => void;
    /** `isWatched` and `setWatched` in the shape lists take for their stars; stable until the watchlist changes. */
    controls: WatchControls;
    isLoading: boolean;
    error: Error | null;
    /** The league and unit the answer was for (it can trail the page's while a switch loads). */
    answer: { league: string; unit: Unit } | undefined;
    refetch: () => void;
}

/**
 * The watchlist for the page's league and unit. Call it once per view and hand `isWatched` and `setWatched` down: every
 * call is its own subscription to the query and to the pending toggles.
 *
 * A toggle is not written into the cache: while it is pending (until the refetch it triggers has landed) the pending
 * state is laid over whatever is cached, so a failed request needs no rollback, the star just falls back.
 */
export function useWatchlist(): Watchlist {
    const { scope } = useEconomyContext();
    const queryClient = useQueryClient();
    const query = useWatchlistQuery(scope);
    const pending = usePendingToggles();
    const toggle = useMutation({
        mutationKey: TOGGLE_KEY,
        // One at a time and in order: a PUT and the DELETE after it must not cross on the server.
        scope: { id: 'watchlist' },
        mutationFn: ({ itemId, watched }: PendingToggle) => sendApi('/watchlist/' + itemId, { method: watched ? 'PUT' : 'DELETE' }),
        onError: (error) => void toast.error(toToggleErrorMessage(error), { id: ERROR_TOAST_ID }),
        // Returning the promise keeps the toggle pending until the answer on screen is the new one.
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
    });
    const mutate = toggle.mutate;

    const wanted = useMemo(() => toWantedStates(pending), [pending]);
    const rows = useMemo(() => withoutPendingRemovals(query.data?.rows ?? [], wanted), [query.data, wanted]);
    const unlisted = useMemo(() => withoutPendingRemovals(query.data?.unlisted ?? [], wanted), [query.data, wanted]);
    const watchedIds = useMemo(() => toWatchedIds(query.data?.rows ?? [], query.data?.unlisted ?? [], wanted), [query.data, wanted]);
    const isWatched = useCallback((itemId: number) => watchedIds.has(itemId), [watchedIds]);
    const isFull = isFullList(watchedIds.size);
    const setWatched = useCallback(
        (item: Pick<ItemRef, 'id'>, watched: boolean) => {
            // The server refuses too, but saying so at once keeps the star from flipping on and back.
            if (watched && isFull && !watchedIds.has(item.id))
                return void toast.error(toToggleErrorMessage(new ApiError(409, '/watchlist', WATCHLIST_FULL_CODE, null)), { id: ERROR_TOAST_ID });

            mutate({ itemId: item.id, watched });
        },
        [mutate, isFull, watchedIds],
    );

    const controls = useMemo(() => ({ isWatched, onToggle: setWatched }), [isWatched, setWatched]);

    return {
        controls,
        rows,
        unlisted,
        count: watchedIds.size,
        isFull,
        isWatched,
        setWatched,
        isLoading: query.isLoading,
        error: query.error,
        refetch: () => void query.refetch(),
        answer: query.data && { league: query.data.league.name, unit: query.data.unit },
    };
}
