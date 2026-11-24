import type { ItemRef, LeagueRef } from '@poelens/shared';
import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { useHistory, useLatest } from '@/lib/api/prices';
import { useWatchlist } from '@/lib/api/watchlist';
import type { WatchControls } from '@/lib/watchlist/controls';
import { WatchButton } from '@/components/watchlist/WatchButton';
import { toCategoryLabel } from '@/lib/economy/category-label';
import { type Range } from '@/lib/economy/search-params';
import { useMediaQuery } from '@/lib/use-media-query';
import { GAME, useEconomyContext } from '@/lib/economy/use-economy-context';
import { HeaderBreadcrumb } from '@/components/layout/HeaderBreadcrumb';
import { HistoryCard } from './HistoryCard';
import { ItemIcon } from './ItemIcon';
import { ItemStats, type ShownPrice } from './ItemStats';
import { ErrorState, NoItemPriceState } from './states';

type LatestQuery = ReturnType<typeof useLatest>;

/** The item's row from a `latest` answer, only when the answer is for this item: a new item first shows the old one's. */
function toShownPrice(query: LatestQuery, itemId: number): ShownPrice | undefined {
    const row = query.data?.rows.find((candidate) => candidate.item.id === itemId);

    if (!query.data || !row) return undefined;

    return { row, key: `${itemId}:${query.data.league.name}:${row.unit}`, league: query.data.league };
}

/** "Forbidden Rites (softcore)": the league and which of its two ladders the prices are from. */
function toLeagueLabel(league: LeagueRef): string {
    return `${league.name} (${league.hardcore ? 'hardcore' : 'softcore'})`;
}

/** Between md and xl the header has no room for the trail and must stay one row high (the sidebar sticks below it), so the trail sits above the title instead. */
const NARROW_DESKTOP = '(min-width: 768px) and (max-width: 1279px)';

function ItemBreadcrumb({ item, categoryLabel }: { item: ItemRef; categoryLabel: string }) {
    const isInline = useMediaQuery(NARROW_DESKTOP);
    const trail = (
        <nav aria-label="Breadcrumb" className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm whitespace-nowrap">
            <Link to="/" className="hover:text-foreground rounded-sm underline-offset-4 hover:underline">
                Economy
            </Link>
            <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
            <Link to="/economy/$category" params={{ category: item.category }} className="hover:text-foreground rounded-sm underline-offset-4 hover:underline">
                {categoryLabel}
            </Link>
            <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="text-foreground truncate" aria-current="page">
                {item.name}
            </span>
        </nav>
    );

    return (
        <>
            <HeaderBreadcrumb enabled={!isInline}>{trail}</HeaderBreadcrumb>
            {isInline && trail}
        </>
    );
}

function ItemHeading({ item, league, watch }: { item: ItemRef; league: LeagueRef | undefined; watch: WatchControls }) {
    const categoryLabel = toCategoryLabel(GAME, item.category);

    return (
        <>
            <ItemBreadcrumb item={item} categoryLabel={categoryLabel} />
            <div className="flex flex-wrap items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                    <ItemIcon item={item} size="lg" />
                    <div>
                        <h1 className="font-heading text-[38px] leading-tight font-bold tracking-[-0.03em]">{item.name}</h1>
                        <p className="text-muted-foreground text-sm">
                            {[item.baseType, categoryLabel, league && toLeagueLabel(league)].filter(Boolean).join(' · ')}
                        </p>
                    </div>
                </div>
                <WatchButton ready={watch.isReady} watched={watch.isWatched(item.id)} onToggle={(watched) => watch.onToggle(item, watched)} />
            </div>
        </>
    );
}

/** One item: its price in the unit it reads best in, and in the other two, how it moved, and its history over a chosen range. */
export function ItemPage({ itemId, range }: { itemId: number; range: Range }) {
    const { scope, leagues, league } = useEconomyContext();
    const navigate = useNavigate();
    const { controls } = useWatchlist();
    const history = useHistory(scope, itemId, range, league?.firstSeen);
    // One `latest` query: the row carries its price in every unit, the large number in the row's own.
    const priced = useLatest(scope, [itemId], { refresh: true });
    const shown = toShownPrice(priced, itemId);
    // The query hands back the previous item's answer while a new one loads; only this item's answer is shown.
    const answer = history.data?.item.id === itemId ? history.data : undefined;
    const item = answer?.item ?? shown?.row.item;

    if (leagues && !league && scope.league !== 'current') return <UnknownLeague name={scope.league} />;

    if (history.isError && !answer) return <HistoryError error={history.error} onRetry={() => void history.refetch()} />;

    if (!item) return <ItemSkeleton />;

    // Only a real answer (not the previous one kept on screen) that lists this item as unpriced, and only for an item the history knows.
    const unpricedIn = priced.data && !priced.isPlaceholderData && priced.data.unlisted.includes(itemId) ? priced.data.league.name : undefined;

    const setRange = (next: Range) =>
        void navigate({ to: '.', replace: true, search: (previous) => ({ ...previous, range: next === '7d' ? undefined : next }) });

    return (
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
            <ItemHeading item={item} league={answer?.league ?? shown?.league} watch={controls} />
            {unpricedIn ? <NoItemPriceState league={unpricedIn} /> : <ItemStats shown={shown} />}
            <HistoryCard history={answer} itemName={item.name} range={range} onRange={setRange} />
        </div>
    );
}

function UnknownLeague({ name }: { name: string }) {
    return <ErrorState title="This league does not exist" message={`There is no league called ${name}. Pick one from the league menu.`} />;
}

function HistoryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
    if (error instanceof ApiError && error.status === 404) {
        return <ErrorState title="This item does not exist" message="Check the link, or find the item with the search (Ctrl+K or ⌘K)." />;
    }

    return <ErrorState title="Could not load this item" onRetry={onRetry} />;
}

function ItemSkeleton() {
    return (
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6" aria-busy="true" aria-label="Loading item">
            <div className="flex items-center gap-4">
                <Skeleton className="size-[60px] rounded-2xl" />
                <Skeleton className="h-8 w-64" />
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
                {[0, 1, 2, 3].map((index) => (
                    <Skeleton key={index} className="h-24 rounded-xl" />
                ))}
            </div>
            <Skeleton className="h-96 rounded-xl" />
        </div>
    );
}
