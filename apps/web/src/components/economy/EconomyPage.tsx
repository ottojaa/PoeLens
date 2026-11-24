import { CATEGORIES, type Category, type Prices, type TableRow } from '@poelens/shared';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, type ReactNode } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api/client';
import { useCurrencyRows, useTable } from '@/lib/api/prices';
import { useWatchlist } from '@/lib/api/watchlist';
import { DEFAULT_SORT } from '@/lib/economy/columns';
import { toColumnsParam, type EconomyView } from '@/lib/economy/search-params';
import { filterRows, sortRows } from '@/lib/economy/sort';
import { GAME, useEconomyContext } from '@/lib/economy/use-economy-context';
import { formatRates, toRates } from '@/lib/economy/rates';
import { formatAgo } from '@/lib/format';
import { useMediaQuery } from '@/lib/use-media-query';
import { toTableBlock } from '@/lib/dashboard/editor';
import { AddToDashboard } from './AddToDashboard';
import { EconomyCards, SortControl } from './EconomyCards';
import { EconomyTable } from './EconomyTable';
import { EconomyToolbar, type ViewChange } from './EconomyToolbar';
import { ErrorState, NoDataState, NoMatchState, TableSkeleton } from './states';
import type { SortKey } from '@/lib/economy/columns';

/** A category's own label for what its liquidity column counts: stash items have listings, exchange items a traded value in divine. */
function toLiquidityLabel(category: Category): string {
    return category.endpoint === 'stash' ? 'Listings' : 'Traded (div)';
}

/** Where a category's prices come from, as the page's meta line names it. */
function toSourceLabel(category: Category): string {
    return category.endpoint === 'stash' ? 'Listed in stashes' : 'Currency exchange';
}

/** The line under the title: where the prices come from, how fresh they are and the exchange rates between the units. */
function toMeta(category: Category, rows: readonly TableRow[] | undefined, rates: Prices | undefined): string {
    if (!rows) return 'Loading prices';

    const asOf = rows[0]?.asOf;

    return [toSourceLabel(category), asOf && `updated ${formatAgo(asOf)}`, rates && formatRates(rates)].filter(Boolean).join(' · ');
}

/** Writes the economy view into the URL, leaving out whatever equals the default so a plain view keeps a plain URL. */
export function useViewNavigation(view: EconomyView) {
    const navigate = useNavigate();

    function replaceSearch(patch: Record<string, unknown>) {
        void navigate({ to: '.', replace: true, search: (previous) => ({ ...previous, ...patch }) });
    }

    return {
        change(change: ViewChange) {
            replaceSearch({
                ...('q' in change && { q: change.q || undefined }),
                ...('min' in change && { min: change.min || undefined }),
                ...(change.columns && { cols: toColumnsParam(change.columns) }),
            });
        },
        setHideLow(hideLow: boolean) {
            replaceSearch({ hideLow: hideLow ? undefined : false });
        },
        sortBy(key: SortKey) {
            const direction = view.sort === key ? (view.dir === 'asc' ? 'desc' : 'asc') : key === 'name' ? 'asc' : 'desc';
            const isDefault = key === DEFAULT_SORT.sort && direction === DEFAULT_SORT.dir;

            replaceSearch({ sort: isDefault ? undefined : key, dir: isDefault ? undefined : direction });
        },
        clearFilters() {
            replaceSearch({ q: undefined, min: undefined });
        },
    };
}

function PageHeading({
    title,
    meta,
    hideLow,
    onHideLow,
    action,
}: {
    title: string;
    meta: string;
    hideLow: boolean;
    onHideLow: (hideLow: boolean) => void;
    action: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div>
                <h1 className="font-heading text-[30px] leading-tight font-bold">{title}</h1>
                <p className="text-muted-foreground mt-1 text-sm">{meta}</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Label className="flex min-h-11 cursor-pointer items-center gap-2 font-normal">
                    <Checkbox checked={hideLow} onCheckedChange={(checked) => onHideLow(checked === true)} />
                    Hide low-confidence prices
                </Label>
                {action}
            </div>
        </div>
    );
}

function TableError({ error, league, onRetry }: { error: unknown; league: string; onRetry: () => void }) {
    const unknownLeague = error instanceof ApiError && error.status === 404;

    if (!unknownLeague) return <ErrorState onRetry={onRetry} />;

    return <ErrorState title="This league does not exist" message={`There is no league called ${league}. Pick one from the league menu.`} />;
}

/** One category, or a not-found state for a link to a category the game does not have. */
export function EconomyPage({ categoryId, view }: { categoryId: string; view: EconomyView }) {
    const category = CATEGORIES[GAME].find((candidate) => candidate.id === categoryId);

    if (!category) return <ErrorState title="This category does not exist" message="Pick one from the menu." />;

    return <CategoryView category={category} view={view} />;
}

/** The heading, the filters, and the sortable table with its loading, empty and error states. */
function CategoryView({ category, view }: { category: Category; view: EconomyView }) {
    const { scope, league } = useEconomyContext();
    const query = useTable(scope, category.id, !view.hideLow);
    const { controls } = useWatchlist();
    // While a new category, league or unit loads, the query hands back the previous answer. Rows and labels come from
    // the answer itself, so they never describe one scope with another's numbers; a different category is not shown at all.
    const data = query.data?.category === category.id ? query.data : undefined;
    const navigation = useViewNavigation(view);
    // From md up the table fits; below it each item is a card, and sorting moves to a menu.
    const isWide = useMediaQuery('(min-width: 768px)');
    const liquidityLabel = toLiquidityLabel(category);
    const rows = data?.rows;
    const visible = useMemo(
        () => (rows ? sortRows(filterRows(rows, view.q, view.min), view.sort, view.dir) : []),
        [rows, view.q, view.min, view.sort, view.dir],
    );
    const rates = toRates(useCurrencyRows(scope).data?.rows);
    const meta = toMeta(category, rows, rates);

    return (
        <div className="flex flex-col gap-5">
            <PageHeading
                title={category.label}
                meta={meta}
                hideLow={view.hideLow}
                onHideLow={navigation.setHideLow}
                action={<AddToDashboard block={toTableBlock(category.id, view)} title={category.label} />}
            />
            <EconomyToolbar view={view} liquidityLabel={liquidityLabel} onChange={navigation.change} />
            {!isWide && <SortControl sort={{ key: view.sort, direction: view.dir }} liquidityLabel={liquidityLabel} onSort={navigation.sortBy} />}
            <div className="bg-card overflow-x-auto rounded-xl border">
                <div className="md:min-w-[760px]">
                    {!data && !query.isError && <TableSkeleton />}
                    {query.isError && !rows && <TableError error={query.error} league={scope.league} onRetry={() => void query.refetch()} />}
                    {rows && rows.length === 0 && <NoDataState league={league?.name} />}
                    {rows && rows.length > 0 && visible.length === 0 && <NoMatchState onClear={navigation.clearFilters} />}
                    {data && visible.length > 0 && !isWide && (
                        <EconomyCards
                            rows={visible}
                            scopeKey={`${data.league.name}:${data.unit}`}
                            liquidityLabel={liquidityLabel}
                            options={{ watch: controls }}
                        />
                    )}
                    {data && visible.length > 0 && isWide && (
                        <EconomyTable
                            rows={visible}
                            scopeKey={`${data.league.name}:${data.unit}`}
                            columns={view.columns}
                            sort={{ key: view.sort, direction: view.dir }}
                            onSort={navigation.sortBy}
                            liquidityLabel={liquidityLabel}
                            options={{ watch: controls }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
