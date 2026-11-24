import type { TableRow } from '@poelens/shared';
import { Link } from '@tanstack/react-router';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { COLUMN_LABELS, SORT_KEYS, type SortKey } from '@/lib/economy/columns';
import { toCategoryLabel } from '@/lib/economy/category-label';
import { GAME } from '@/lib/economy/use-economy-context';
import { UNIT_SHORT } from '@/lib/economy/units';
import { formatLiquidity, formatLiquidityWithUnit, formatPrice } from '@/lib/format';
import { WatchStar } from '@/components/watchlist/WatchStar';
import type { WatchControls } from '@/lib/watchlist/controls';
import { cn } from '@/lib/utils';
import { AnimatedList, canAnimateLayout } from '@/motion/AnimatedList';
import { AnimatedNumber } from '@/motion/AnimatedNumber';
import { Change } from './Change';
import { ItemIcon } from './ItemIcon';
import { Sparkline } from './Sparkline';
import type { TableSort } from './EconomyTable';

function Labelled({ label, children }: { label: string; children: ReactNode }) {
    return (
        <span className="flex items-baseline gap-1.5">
            <span className="text-muted-foreground text-xs">{label}</span>
            {children}
        </span>
    );
}

interface CardOptions {
    watch?: WatchControls;
    liquidityUnits?: boolean;
    /** Cards fade out when removed and glide up: for short lists only. */
    animate?: boolean;
}

function Card({ row, scopeKey, liquidityLabel, options }: { row: TableRow; scopeKey: string; liquidityLabel: string; options: CardOptions }) {
    const { watch, liquidityUnits } = options;

    return (
        <div className="relative">
            {/* Beside the link, not inside it: a tap on the star must not open the item. */}
            {watch && (
                <WatchStar
                    name={row.item.name}
                    watched={watch.isWatched(row.item.id)}
                    onToggle={(watched) => watch.onToggle(row.item, watched)}
                    className="absolute top-3 left-2 z-10"
                />
            )}
            <Link
                to="/items/$itemId"
                params={{ itemId: String(row.item.id) }}
                className={cn(
                    'active:bg-accent focus-visible:ring-ring/50 flex flex-col gap-2.5 py-3 pr-4 outline-none focus-visible:ring-[3px] focus-visible:ring-inset',
                    watch ? 'pl-12' : 'pl-4',
                )}
            >
                <span className="flex items-center gap-3">
                    <ItemIcon item={row.item} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate font-semibold">{row.item.name}</span>
                        <span className="text-muted-foreground truncate text-xs">{row.item.baseType ?? toCategoryLabel(GAME, row.item.category)}</span>
                    </span>
                    <span className="shrink-0 text-right font-semibold">
                        <AnimatedNumber key={`${scopeKey}:${row.unit}`} value={row.price} format={formatPrice} />
                        <span className="text-muted-foreground ml-1 font-medium">{UNIT_SHORT[row.unit]}</span>
                        {row.lowConfidence && (
                            <Badge
                                variant="outline"
                                className="text-warning border-warning/50 ml-2"
                                title="Few listings or little trading: the price may be unreliable"
                            >
                                low
                            </Badge>
                        )}
                    </span>
                </span>
                <span className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-4">
                        <Labelled label="24h">
                            <Change percent={row.change.h24} />
                        </Labelled>
                        <Labelled label="7d">
                            <Change percent={row.change.d7} />
                        </Labelled>
                    </span>
                    <Sparkline points={row.sparkline} change={row.change.d7} />
                </span>
                <Labelled label={liquidityLabel}>
                    <span className="text-foreground/80 text-sm">
                        {row.liquidity ? (liquidityUnits ? formatLiquidityWithUnit(row.liquidity) : formatLiquidity(row.liquidity)) : '—'}
                    </span>
                </Labelled>
            </Link>
        </div>
    );
}

/** The phone layout of the price list: one tappable card per item instead of a table. */
export function EconomyCards({
    rows,
    scopeKey,
    liquidityLabel,
    options = {},
}: {
    rows: readonly TableRow[];
    scopeKey: string;
    liquidityLabel: string;
    options?: CardOptions;
}) {
    const renderCard = (row: TableRow) => <Card row={row} scopeKey={scopeKey} liquidityLabel={liquidityLabel} options={options} />;

    if (options.animate && canAnimateLayout(rows.length)) {
        return <AnimatedList items={rows} getKey={(row) => String(row.item.id)} renderItem={renderCard} className="divide-y" />;
    }

    return (
        <ul className="divide-y">
            {rows.map((row) => (
                <li key={row.item.id}>{renderCard(row)}</li>
            ))}
        </ul>
    );
}

/** What the sort menu calls each column; the cards have no header row to click, so sorting lives here. */
function toSortLabel(key: SortKey, liquidityLabel: string): string {
    if (key === 'name') return 'Item';

    if (key === 'price') return 'Price';

    if (key === 'liquidity') return liquidityLabel;

    return COLUMN_LABELS[key];
}

/** Sort column and direction as two compact controls, for the phone layout. Picking the current column again flips it. */
export function SortControl({ sort, liquidityLabel, onSort }: { sort: TableSort; liquidityLabel: string; onSort: (key: SortKey) => void }) {
    const Arrow = sort.direction === 'asc' ? ArrowUp : ArrowDown;

    return (
        <div className="flex items-center gap-2">
            <label className="text-muted-foreground text-sm" htmlFor="sort-column">
                Sort by
            </label>
            <select
                id="sort-column"
                value={sort.key}
                onChange={(event) => {
                    const key = SORT_KEYS.find((candidate) => candidate === event.target.value);

                    if (key) onSort(key);
                }}
                className="border-input bg-background h-10 min-w-0 flex-1 rounded-md border px-3 text-sm"
            >
                {SORT_KEYS.map((key) => (
                    <option key={key} value={key}>
                        {toSortLabel(key, liquidityLabel)}
                    </option>
                ))}
            </select>
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10"
                onClick={() => onSort(sort.key)}
                aria-label={sort.direction === 'asc' ? 'Ascending, switch to descending' : 'Descending, switch to ascending'}
            >
                <Arrow aria-hidden="true" />
            </Button>
        </div>
    );
}
