import { CATEGORIES, type Category } from '@poelens/shared';
import { useNavigate } from '@tanstack/react-router';
import { useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTable } from '@/lib/api/prices';
import { DEFAULT_SORT } from '@/lib/economy/columns';
import { toColumnsParam, type EconomyView } from '@/lib/economy/search-params';
import { filterRows, sortRows } from '@/lib/economy/sort';
import { GAME, useEconomyContext } from '@/lib/economy/use-economy-context';
import { formatAgo } from '@/lib/format';
import { EconomyTable } from './EconomyTable';
import { EconomyToolbar, type ViewChange } from './EconomyToolbar';
import { ErrorState, NoDataState, NoMatchState, TableSkeleton } from './states';
import type { SortKey } from '@/lib/economy/columns';

/** A category's own label for what its liquidity column counts. */
function toLiquidityLabel(category: Category | undefined): string {
    return category?.endpoint === 'stash' ? 'Listings' : 'Volume';
}

/** Writes the economy view into the URL, leaving out whatever equals the default so a plain view keeps a plain URL. */
function useViewNavigation(view: EconomyView) {
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

function PageHeading({ title, meta, hideLow, onHideLow }: { title: string; meta: string; hideLow: boolean; onHideLow: (hideLow: boolean) => void }) {
    return (
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div>
                <h1 className="font-heading text-[30px] leading-tight font-bold">{title}</h1>
                <p className="text-muted-foreground mt-1 text-sm">{meta}</p>
            </div>
            <Label className="flex min-h-11 cursor-pointer items-center gap-2 font-normal">
                <Checkbox checked={hideLow} onCheckedChange={(checked) => onHideLow(checked === true)} />
                Hide low-confidence prices
            </Label>
        </div>
    );
}

/** One category: the heading, the filters, and the sortable table with its loading, empty and error states. */
export function EconomyPage({ categoryId, view }: { categoryId: string; view: EconomyView }) {
    const { scope, leagueName } = useEconomyContext();
    const category = CATEGORIES[GAME].find((candidate) => candidate.id === categoryId);
    const table = useTable(scope, categoryId, !view.hideLow);
    const navigation = useViewNavigation(view);
    const liquidityLabel = toLiquidityLabel(category);
    const rows = table.data?.rows;
    const visible = useMemo(
        () => (rows ? sortRows(filterRows(rows, view.q, view.min), view.sort, view.dir) : []),
        [rows, view.q, view.min, view.sort, view.dir],
    );
    const asOf = rows?.[0]?.asOf;
    const meta = rows ? `${rows.length} items · updated ${asOf ? formatAgo(asOf) : 'just now'}` : 'Loading prices';

    return (
        <div className="flex flex-col gap-5">
            <PageHeading title={category?.label ?? categoryId} meta={meta} hideLow={view.hideLow} onHideLow={navigation.setHideLow} />
            <EconomyToolbar view={view} liquidityLabel={liquidityLabel} onChange={navigation.change} />
            <div className="bg-card overflow-x-auto rounded-xl border">
                <div className="min-w-[760px]">
                    {table.isPending && <TableSkeleton />}
                    {table.isError && !rows && <ErrorState onRetry={() => void table.refetch()} />}
                    {rows && rows.length === 0 && <NoDataState league={leagueName} />}
                    {rows && rows.length > 0 && visible.length === 0 && <NoMatchState onClear={navigation.clearFilters} />}
                    {visible.length > 0 && (
                        <EconomyTable
                            rows={visible}
                            unit={scope.unit}
                            scopeKey={`${scope.league}:${scope.unit}`}
                            columns={view.columns}
                            sort={{ key: view.sort, direction: view.dir }}
                            onSort={navigation.sortBy}
                            liquidityLabel={liquidityLabel}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
