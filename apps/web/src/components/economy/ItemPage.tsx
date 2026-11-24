import { CATEGORIES, UNITS, type ItemRef, type LeagueRef, type Unit } from '@poelens/shared';
import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { useHistory, useLatest } from '@/lib/api/prices';
import { type Range } from '@/lib/economy/search-params';
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

    return { row, key: `${itemId}:${query.data.league.name}:${query.data.unit}`, league: query.data.league };
}

/** "Forbidden Rites (softcore)": the league and which of its two ladders the prices are from. */
function toLeagueLabel(league: LeagueRef): string {
    return `${league.name} (${league.hardcore ? 'hardcore' : 'softcore'})`;
}

function ItemBreadcrumb({ item, categoryLabel }: { item: ItemRef; categoryLabel: string }) {
    return (
        <HeaderBreadcrumb>
            <nav aria-label="Breadcrumb" className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm whitespace-nowrap">
                <Link to="/" className="hover:text-foreground rounded-sm underline-offset-4 hover:underline">
                    Economy
                </Link>
                <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
                <Link
                    to="/economy/$category"
                    params={{ category: item.category }}
                    className="hover:text-foreground rounded-sm underline-offset-4 hover:underline"
                >
                    {categoryLabel}
                </Link>
                <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="text-foreground truncate" aria-current="page">
                    {item.name}
                </span>
            </nav>
        </HeaderBreadcrumb>
    );
}

function ItemHeading({ item, league }: { item: ItemRef; league: LeagueRef | undefined }) {
    const category = CATEGORIES[GAME].find((candidate) => candidate.id === item.category);
    const categoryLabel = category?.label ?? item.category;

    return (
        <>
            <ItemBreadcrumb item={item} categoryLabel={categoryLabel} />
            <div className="flex items-center gap-4">
                <ItemIcon item={item} size="lg" />
                <div>
                    <h1 className="font-heading text-[38px] leading-tight font-bold tracking-[-0.03em]">{item.name}</h1>
                    <p className="text-muted-foreground text-sm">
                        {[item.baseType, categoryLabel, league && toLeagueLabel(league)].filter(Boolean).join(' · ')}
                    </p>
                </div>
            </div>
        </>
    );
}

/** One item: its price in all three units, how it moved, and its history over a chosen range. */
export function ItemPage({ itemId, range }: { itemId: number; range: Range }) {
    const { scope, leagues, league } = useEconomyContext();
    const navigate = useNavigate();
    const history = useHistory(scope, itemId, range, league?.firstSeen);
    // One cached `latest` query per unit: the chosen one is large, the other two sit small beneath it.
    const byUnit: Record<Unit, LatestQuery> = {
        divine: useLatest({ ...scope, unit: 'divine' }, [itemId], { refresh: true }),
        exalted: useLatest({ ...scope, unit: 'exalted' }, [itemId], { refresh: true }),
        chaos: useLatest({ ...scope, unit: 'chaos' }, [itemId], { refresh: true }),
    };
    const shown = toShownPrice(byUnit[scope.unit], itemId);
    const prices = Object.fromEntries(UNITS.map((unit) => [unit, toShownPrice(byUnit[unit], itemId)?.row.price]));
    // The query hands back the previous item's answer while a new one loads; only this item's answer is shown.
    const answer = history.data?.item.id === itemId ? history.data : undefined;
    const item = answer?.item ?? shown?.row.item;

    if (leagues && !league && scope.league !== 'current') return <UnknownLeague name={scope.league} />;

    if (history.isError && !answer) return <HistoryError error={history.error} onRetry={() => void history.refetch()} />;

    if (!item) return <ItemSkeleton />;

    const priced = byUnit[scope.unit];
    // Only a real answer (not the previous one kept on screen) that lists this item as unpriced, and only for an item the history knows.
    const unpricedIn = priced.data && !priced.isPlaceholderData && priced.data.unlisted.includes(itemId) ? priced.data.league.name : undefined;

    const setRange = (next: Range) =>
        void navigate({ to: '.', replace: true, search: (previous) => ({ ...previous, range: next === '7d' ? undefined : next }) });

    return (
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
            <ItemHeading item={item} league={answer?.league ?? shown?.league} />
            {unpricedIn ? <NoItemPriceState league={unpricedIn} /> : <ItemStats shown={shown} unit={scope.unit} prices={prices} />}
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
            <Skeleton className="h-4 w-48" />
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
