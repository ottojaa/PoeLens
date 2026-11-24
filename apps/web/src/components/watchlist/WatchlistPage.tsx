import type { WatchlistRow } from '@poelens/shared';
import { useMemo } from 'react';
import { EconomyCards, SortControl } from '@/components/economy/EconomyCards';
import { useViewNavigation } from '@/components/economy/EconomyPage';
import { EconomyTable } from '@/components/economy/EconomyTable';
import { EconomyToolbar } from '@/components/economy/EconomyToolbar';
import { ErrorState, NoMatchState, TableSkeleton } from '@/components/economy/states';
import { useWatchlist } from '@/lib/api/watchlist';
import type { EconomyView } from '@/lib/economy/search-params';
import { filterRows, sortRows } from '@/lib/economy/sort';
import { formatAgo } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media-query';
import type { WatchControls } from '@/lib/watchlist/controls';
import { EmptyWatchlist } from './EmptyWatchlist';
import { UnlistedItems } from './UnlistedItems';

/** Rows mix categories, so the liquidity column is just "Liquidity" and each cell names its own unit. */
const LIQUIDITY_LABEL = 'Liquidity';

function toItemCount(count: number): string {
    return `${count} ${count === 1 ? 'item' : 'items'}`;
}

/** "3 items · updated 4 minutes ago": the newest price among the rows. */
function toMeta(count: number, rows: readonly WatchlistRow[]): string {
    const newest = rows.reduce<string | undefined>((latest, row) => (!latest || row.asOf > latest ? row.asOf : latest), undefined);

    return [toItemCount(count), newest && `updated ${formatAgo(newest)}`].filter(Boolean).join(' · ');
}

function PricedItems({
    rows,
    scopeKey,
    view,
    onSort,
    controls,
}: {
    controls: WatchControls;
    rows: readonly WatchlistRow[];
    scopeKey: string;
    view: EconomyView;
    onSort: Parameters<typeof EconomyTable>[0]['onSort'];
}) {
    const isWide = useMediaQuery('(min-width: 768px)');
    const options = { watch: controls, liquidityUnits: true, animate: true };
    const sort = { key: view.sort, direction: view.dir };

    if (!isWide) return <EconomyCards rows={rows} scopeKey={scopeKey} liquidityLabel={LIQUIDITY_LABEL} options={options} />;

    return (
        <EconomyTable rows={rows} scopeKey={scopeKey} columns={view.columns} sort={sort} onSort={onSort} liquidityLabel={LIQUIDITY_LABEL} options={options} />
    );
}

/** The signed-in user's watched items with their recent movement, a filter and sort like the economy view's, and the items with no price here. */
export function WatchlistPage({ view }: { view: EconomyView }) {
    const { rows, unlisted, count, answer, error, refetch, controls } = useWatchlist();
    const navigation = useViewNavigation(view);
    const isWide = useMediaQuery('(min-width: 768px)');
    const visible = useMemo(() => sortRows(filterRows(rows, view.q, 0), view.sort, view.dir, { liquidityByKind: true }), [rows, view.q, view.sort, view.dir]);

    if (error && !answer)
        return <ErrorState title="Could not load your watchlist" message="Your watchlist did not load. Nothing on it has changed." onRetry={refetch} />;

    const loaded = answer !== undefined;
    const isEmpty = loaded && count === 0;
    const scopeKey = answer ? `${answer.league}:${answer.unit}` : '';

    return (
        <div className="flex flex-col gap-5">
            <div>
                <h1 className="font-heading text-[30px] leading-tight font-bold">Watchlist</h1>
                <p className="text-muted-foreground mt-1 text-sm">{loaded ? toMeta(count, rows) : 'Loading your watchlist'}</p>
            </div>
            {isEmpty && <EmptyWatchlist />}
            {!isEmpty && (
                <>
                    <EconomyToolbar
                        view={view}
                        liquidityLabel={LIQUIDITY_LABEL}
                        onChange={navigation.change}
                        filterLabel="Filter your watchlist"
                        hasMin={false}
                    />
                    {!isWide && <SortControl sort={{ key: view.sort, direction: view.dir }} liquidityLabel={LIQUIDITY_LABEL} onSort={navigation.sortBy} />}
                    <div className="bg-card overflow-x-auto rounded-xl border">
                        <div className="md:min-w-[760px]">
                            {!loaded && <TableSkeleton rows={5} />}
                            {loaded && rows.length > 0 && visible.length === 0 && <NoMatchState onClear={navigation.clearFilters} />}
                            {answer && visible.length > 0 && (
                                <PricedItems rows={visible} scopeKey={scopeKey} view={view} onSort={navigation.sortBy} controls={controls} />
                            )}
                            {loaded && rows.length === 0 && unlisted.length > 0 && (
                                <p className="text-muted-foreground px-6 py-8 text-center text-sm">None of your items has a price in {answer.league}.</p>
                            )}
                        </div>
                    </div>
                    {answer && <UnlistedItems items={unlisted} league={answer.league} controls={controls} />}
                </>
            )}
        </div>
    );
}
