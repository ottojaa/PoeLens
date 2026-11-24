import type { TableRow } from '@poelens/shared';
import { Link } from '@tanstack/react-router';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { COLUMN_LABELS, SORT_KEYS, type SortKey } from '@/lib/economy/columns';
import { UNIT_SHORT } from '@/lib/economy/units';
import { formatLiquidity, formatPrice } from '@/lib/format';
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

function Card({ row, scopeKey, liquidityLabel }: { row: TableRow; scopeKey: string; liquidityLabel: string }) {
    return (
        <li className="border-t first:border-t-0">
            <Link
                to="/items/$itemId"
                params={{ itemId: String(row.item.id) }}
                className="active:bg-accent focus-visible:ring-ring/50 flex flex-col gap-2.5 px-4 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
            >
                <span className="flex items-center gap-3">
                    <ItemIcon item={row.item} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate font-semibold">{row.item.name}</span>
                        <span className="text-muted-foreground truncate text-xs">{row.item.baseType ?? row.item.category}</span>
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
                    <span className="text-foreground/80 text-sm">{row.liquidity ? formatLiquidity(row.liquidity) : '—'}</span>
                </Labelled>
            </Link>
        </li>
    );
}

/** The phone layout of the price list: one tappable card per item instead of a table. */
export function EconomyCards({ rows, scopeKey, liquidityLabel }: { rows: readonly TableRow[]; scopeKey: string; liquidityLabel: string }) {
    return (
        <ul>
            {rows.map((row) => (
                <Card key={row.item.id} row={row} scopeKey={scopeKey} liquidityLabel={liquidityLabel} />
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
