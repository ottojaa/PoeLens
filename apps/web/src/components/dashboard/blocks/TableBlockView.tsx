import { CATEGORIES, COLUMN_LABELS, type OptionalColumn, type TableBlock, type TableBlockData, type TableRow } from '@poelens/shared';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Change } from '@/components/economy/Change';
import { ItemIcon } from '@/components/economy/ItemIcon';
import { Sparkline } from '@/components/economy/Sparkline';
import { toLiquidityLabel } from '@/lib/economy/columns';
import { GAME } from '@/lib/economy/use-economy-context';
import { formatLiquidity, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BlockMessage, BlockTitle, ItemLink } from './DataRow';
import { toTableTitle } from './block-format';
import { UnitMark } from './UnitMark';

const CHANGE_KEY = { h1: 'h1', h24: 'h24', d7: 'd7' } as const;

/** Wide enough that a sorted change column's arrow and heading stay on one line. */
const CHANGE_CLASS = 'w-[76px] shrink-0 text-right whitespace-nowrap';

/** Trend shows from a 420px panel and listings from 520px; `toColumnClass` says when a change column shows. */
const COLUMN_CLASS: Record<OptionalColumn, string> = {
    h1: CHANGE_CLASS,
    h24: CHANGE_CLASS,
    d7: CHANGE_CLASS,
    trend: 'hidden w-[70px] shrink-0 justify-end @min-[420px]:flex',
    liquidity: 'hidden w-[70px] shrink-0 text-right @min-[520px]:block',
};

/** So the item's name stays readable in a narrow panel, the first change column shows from 300px and further ones from 420px. */
function toColumnClass(column: OptionalColumn, index: number): string {
    const isChange = column === 'h1' || column === 'h24' || column === 'd7';

    return cn(COLUMN_CLASS[column], isChange && (index > 0 ? 'hidden @min-[420px]:block' : 'hidden @min-[300px]:block'));
}

function Cell({ column, index, row }: { column: OptionalColumn; index: number; row: TableRow }) {
    if (column === 'trend')
        return (
            <span className={toColumnClass(column, index)}>
                <Sparkline points={row.sparkline} change={row.change.d7} width={64} height={22} />
            </span>
        );

    if (column === 'liquidity')
        return (
            <span className={cn(toColumnClass(column, index), 'text-muted-foreground text-xs')}>{row.liquidity ? formatLiquidity(row.liquidity) : '—'}</span>
        );

    return (
        <span className={toColumnClass(column, index)}>
            <Change percent={row.change[CHANGE_KEY[column]]} className="text-[13px]" />
        </span>
    );
}

/** The column's heading, in the words the category's own page uses for its liquidity. */
function toHeading(column: OptionalColumn, categoryId: string): string {
    const category = CATEGORIES[GAME].find((candidate) => candidate.id === categoryId);

    return column === 'liquidity' && category ? toLiquidityLabel(category) : COLUMN_LABELS[column];
}

function HeaderCell({ column, index, block }: { column: OptionalColumn; index: number; block: TableBlock }) {
    const Arrow = block.dir === 'asc' ? ArrowUp : ArrowDown;
    const sorted = block.sort === column;

    return (
        <span className={cn(toColumnClass(column, index), sorted && 'text-foreground')}>
            {sorted && <Arrow aria-label={block.dir === 'asc' ? 'ascending' : 'descending'} className="mr-0.5 inline size-3 align-[-1px]" />}
            {toHeading(column, block.category)}
        </span>
    );
}

const HEADER_CLASS = 'text-muted-foreground flex items-center gap-2.5 pb-1 text-[11px] font-semibold tracking-[0.06em] uppercase';

/** A category's items as a compact price table: the same rows, sort and filter as the economy page, top N of them. */
export function TableBlockView({ block, data }: { block: TableBlock; data: TableBlockData | null | undefined }) {
    if (data === undefined) return <BlockMessage>Loading…</BlockMessage>;

    const title = toTableTitle(GAME, block);

    if (data === null) return <BlockMessage>{title}: no prices in this league</BlockMessage>;

    return (
        <div>
            <BlockTitle>{title}</BlockTitle>
            <div className={HEADER_CLASS} aria-hidden="true">
                <span className="min-w-0 flex-1">Item</span>
                <span className="w-[72px] shrink-0 text-right">Price</span>
                {block.columns.map((column, index) => (
                    <HeaderCell key={column} column={column} index={index} block={block} />
                ))}
            </div>
            {data.rows.length === 0 && <BlockMessage>No items match</BlockMessage>}
            {data.rows.map((row) => (
                <ItemLink key={row.item.id} item={row.item} className="border-border flex min-h-11 items-center gap-2.5 border-t">
                    <ItemIcon item={row.item} size="xs" />
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] font-semibold">{row.item.name}</span>
                        {row.item.baseType && <span className="text-muted-foreground truncate text-[11px]">{row.item.baseType}</span>}
                    </span>
                    <span className="flex w-[72px] shrink-0 items-center justify-end gap-1 text-[13px] font-semibold">
                        {formatPrice(row.price)}
                        <UnitMark unit={row.unit} />
                    </span>
                    {block.columns.map((column, index) => (
                        <Cell key={column} column={column} index={index} row={row} />
                    ))}
                </ItemLink>
            ))}
            {data.total > data.rows.length && (
                <span className="text-muted-foreground mt-1 block text-xs">
                    Top {data.rows.length} of {data.total}
                </span>
            )}
        </div>
    );
}
