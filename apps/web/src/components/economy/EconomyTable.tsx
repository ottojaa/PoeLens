import type { TableRow, Unit } from '@poelens/shared';
import { Link } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { OptionalColumn, SortDirection, SortKey } from '@/lib/economy/columns';
import { UNIT_SHORT } from '@/lib/economy/units';
import { formatLiquidity, formatLiquidityWithUnit, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { WatchStar } from '@/components/watchlist/WatchStar';
import type { WatchControls } from '@/lib/watchlist/controls';
import { AnimatedNumber } from '@/motion/AnimatedNumber';
import { DURATION, EASE_OUT, SPRING } from '@/motion/tokens';
import { Change } from './Change';
import { ItemIcon } from './ItemIcon';
import { Sparkline } from './Sparkline';

export interface TableSort {
    key: SortKey;
    direction: SortDirection;
}

const CELL = 'px-2 py-2.5 whitespace-nowrap';

function SortHeader({
    label,
    sortKey,
    sort,
    onSort,
    align = 'right',
}: {
    label: string;
    sortKey: SortKey;
    sort: TableSort;
    onSort: (key: SortKey) => void;
    align?: 'left' | 'right';
}) {
    const active = sort.key === sortKey;
    const Arrow = sort.direction === 'asc' ? ArrowUp : ArrowDown;

    return (
        <th
            scope="col"
            aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
            className={cn('p-0 font-semibold', align === 'right' && 'text-right')}
        >
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onSort(sortKey)}
                className={cn(
                    'h-10 gap-1 rounded-none px-2 text-xs font-semibold tracking-wider uppercase',
                    active ? 'text-foreground' : 'text-muted-foreground',
                    align === 'right' && 'flex-row-reverse',
                )}
            >
                {label}
                <Arrow className={cn('size-3.5', !active && 'opacity-0')} aria-hidden="true" />
            </Button>
        </th>
    );
}

/** How a list of rows differs from the plain category table: stars, per-row liquidity units, rows that animate away. */
export interface RowOptions {
    watch?: WatchControls;
    /** Each liquidity cell carries its own unit, for rows of mixed categories. */
    liquidityUnits?: boolean;
    /** Rows glide into place and fade out when removed: for short lists only. */
    animate?: boolean;
}

function Row({
    row,
    unit,
    scopeKey,
    columns,
    options,
}: {
    row: TableRow;
    unit: Unit;
    scopeKey: string;
    columns: readonly OptionalColumn[];
    options: RowOptions;
}) {
    const shows = (column: OptionalColumn) => columns.includes(column);
    const { watch, liquidityUnits, animate } = options;
    const Tr = animate ? motion.tr : 'tr';
    const motionProps = animate
        ? {
              layout: 'position' as const,
              initial: false,
              exit: { opacity: 0 },
              transition: { layout: SPRING, opacity: { duration: DURATION.menu, ease: EASE_OUT } },
          }
        : {};

    return (
        <Tr className="hover:bg-accent border-t transition-colors" {...motionProps}>
            {watch && (
                <td className="py-2.5 pl-4">
                    <WatchStar name={row.item.name} watched={watch.isWatched(row.item.id)} onToggle={(watched) => watch.onToggle(row.item, watched)} />
                </td>
            )}
            <td className={cn('py-2.5 pr-2', watch ? 'pl-2' : 'pl-4')}>
                <div className="flex items-center gap-3">
                    <ItemIcon item={row.item} />
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <Link
                            to="/items/$itemId"
                            params={{ itemId: String(row.item.id) }}
                            className="focus-visible:ring-ring/50 rounded-sm font-semibold outline-none focus-visible:ring-[3px]"
                        >
                            {row.item.name}
                        </Link>
                        <span className="text-muted-foreground truncate text-xs">{row.item.baseType ?? row.item.category}</span>
                    </div>
                </div>
            </td>
            <td className={cn(CELL, 'text-right font-semibold')}>
                {/* Keyed by the scope, so a new unit or league replaces the number instead of counting from the old one. */}
                <AnimatedNumber key={scopeKey} value={row.price} format={formatPrice} />
                <span className="text-muted-foreground ml-1 font-medium">{UNIT_SHORT[unit]}</span>
                {row.lowConfidence && (
                    <Badge
                        variant="outline"
                        className="text-warning border-warning/50 ml-2"
                        title="Few listings or little trading: the price may be unreliable"
                    >
                        low
                    </Badge>
                )}
            </td>
            {shows('h1') && (
                <td className={cn(CELL, 'text-right')}>
                    <Change percent={row.change.h1} />
                </td>
            )}
            {shows('h24') && (
                <td className={cn(CELL, 'text-right')}>
                    <Change percent={row.change.h24} />
                </td>
            )}
            {shows('d7') && (
                <td className={cn(CELL, 'text-right')}>
                    <Change percent={row.change.d7} />
                </td>
            )}
            {shows('trend') && (
                <td className="px-2 py-2.5">
                    <Sparkline points={row.sparkline} change={row.change.d7} />
                </td>
            )}
            {shows('liquidity') && (
                <td className={cn(CELL, 'text-foreground/80 pr-4 text-right')}>
                    {row.liquidity ? (liquidityUnits ? formatLiquidityWithUnit(row.liquidity) : formatLiquidity(row.liquidity)) : '—'}
                </td>
            )}
        </Tr>
    );
}

/**
 * The price table: plain rows (no reorder animation, it would measure every row on every sort), a sortable header,
 * and only the columns the viewer chose. `scopeKey` changes with the league and unit.
 */
export function EconomyTable({
    rows,
    unit,
    scopeKey,
    columns,
    sort,
    onSort,
    liquidityLabel,
    options = {},
}: {
    options?: RowOptions;
    rows: readonly TableRow[];
    unit: Unit;
    scopeKey: string;
    columns: readonly OptionalColumn[];
    sort: TableSort;
    onSort: (key: SortKey) => void;
    liquidityLabel: string;
}) {
    const shows = (column: OptionalColumn) => columns.includes(column);

    return (
        <table className="w-full border-collapse text-sm">
            <thead>
                <tr className="text-left">
                    {options.watch && (
                        <th scope="col" className="w-12 py-3 pl-4">
                            <span className="sr-only">Watch</span>
                        </th>
                    )}
                    <SortHeader label="Item" sortKey="name" sort={sort} onSort={onSort} align="left" />
                    <SortHeader label="Price" sortKey="price" sort={sort} onSort={onSort} />
                    {shows('h1') && <SortHeader label="1 hour" sortKey="h1" sort={sort} onSort={onSort} />}
                    {shows('h24') && <SortHeader label="24 hours" sortKey="h24" sort={sort} onSort={onSort} />}
                    {shows('d7') && <SortHeader label="7 days" sortKey="d7" sort={sort} onSort={onSort} />}
                    {shows('trend') && <SortHeader label="Trend" sortKey="trend" sort={sort} onSort={onSort} align="left" />}
                    {shows('liquidity') && <SortHeader label={liquidityLabel} sortKey="liquidity" sort={sort} onSort={onSort} />}
                </tr>
            </thead>
            <tbody>
                <AnimatePresence initial={false}>
                    {rows.map((row) => (
                        <Row key={row.item.id} row={row} unit={unit} scopeKey={scopeKey} columns={columns} options={options} />
                    ))}
                </AnimatePresence>
            </tbody>
        </table>
    );
}
