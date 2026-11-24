import { UNITS, type PriceRow, type Unit } from '@poelens/shared';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { UNIT_SHORT } from '@/lib/economy/units';
import { formatAgo, formatLiquidity, formatPrice } from '@/lib/format';
import { AnimatedNumber } from '@/motion/AnimatedNumber';
import { Change } from './Change';

/** An item's newest price row with the key of the answer it came from, so a number only counts when the same answer updates. */
export interface ShownPrice {
    row: PriceRow;
    /** Item, league and unit of the answer: a new one remounts the number instead of counting from the old one. */
    key: string;
    /** The league the answer is for, which can lag the URL while a new league loads. */
    leagueName: string;
}

const BIG_NUMBER = 'font-heading text-[32px] leading-tight font-bold tracking-[-0.02em]';

function StatCard({ label, children }: { label: string; children: ReactNode }) {
    return (
        <Card className="bg-card gap-1.5 rounded-xl px-5 py-[18px]">
            <span className="text-muted-foreground text-[13px]">{label}</span>
            {children}
        </Card>
    );
}

/** The item's price in the other two units, small, under the large one. */
function OtherUnits({ unit, prices }: { unit: Unit; prices: Partial<Record<Unit, number>> }) {
    return (
        <div className="text-muted-foreground flex flex-wrap gap-x-4 text-sm">
            {UNITS.filter((candidate) => candidate !== unit).map((other) => (
                <span key={other}>
                    {prices[other] === undefined ? '…' : formatPrice(prices[other])} {UNIT_SHORT[other]}
                </span>
            ))}
        </div>
    );
}

function PriceCard({ shown, unit, prices }: { shown: ShownPrice | undefined; unit: Unit; prices: Partial<Record<Unit, number>> }) {
    if (!shown) return <Skeleton className="h-9 w-32" />;

    return (
        <>
            <span className={BIG_NUMBER}>
                <AnimatedNumber key={shown.key} value={shown.row.price} format={formatPrice} />
                <span className="text-muted-foreground ml-1.5 text-base font-medium">{UNIT_SHORT[unit]}</span>
            </span>
            <OtherUnits unit={unit} prices={prices} />
        </>
    );
}

function ChangeCard({ row, unit }: { row: PriceRow | undefined; unit: Unit }) {
    if (!row) return <Skeleton className="h-9 w-32" />;

    const from = row.change.d7 === null ? null : row.price / (1 + row.change.d7 / 100);

    return (
        <>
            <Change percent={row.change.d7} className={BIG_NUMBER} />
            <span className="text-muted-foreground text-sm">{from === null ? 'Not enough history yet' : `from ${formatPrice(from)} ${UNIT_SHORT[unit]}`}</span>
        </>
    );
}

function LiquidityCard({ row }: { row: PriceRow | undefined }) {
    if (!row) return <Skeleton className="h-9 w-24" />;

    const { liquidity } = row;

    return (
        <>
            <span className={BIG_NUMBER}>
                {liquidity ? formatLiquidity(liquidity) : '—'}
                {liquidity?.kind === 'volume' && <span className="text-muted-foreground ml-1.5 text-lg font-medium">div</span>}
            </span>
            {liquidity && (
                <span className="text-muted-foreground text-[13px]">{liquidity.kind === 'volume' ? 'traded on the currency exchange' : 'open listings'}</span>
            )}
            {row.lowConfidence && <span className="text-warning text-sm">Low confidence: the price may be unreliable</span>}
        </>
    );
}

function UpdatedCard({ row }: { row: PriceRow | undefined }) {
    if (!row) return <Skeleton className="h-9 w-28" />;

    const ago = formatAgo(row.asOf);

    return (
        <span className={BIG_NUMBER}>
            {ago.replace(/ ago$/, '')}
            {ago.endsWith(' ago') && <span className="text-muted-foreground ml-1.5 text-lg font-medium">ago</span>}
        </span>
    );
}

/** The four cards under the title: price (large, with the other units), 7-day change, liquidity and freshness. */
export function ItemStats({ shown, unit, prices }: { shown: ShownPrice | undefined; unit: Unit; prices: Partial<Record<Unit, number>> }) {
    const row = shown?.row;

    return (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
            <StatCard label="Price">
                <PriceCard shown={shown} unit={unit} prices={prices} />
            </StatCard>
            <StatCard label="Change, 7 days">
                <ChangeCard row={row} unit={unit} />
            </StatCard>
            <StatCard label={row?.liquidity?.kind === 'listings' ? 'Listings' : 'Volume'}>
                <LiquidityCard row={row} />
            </StatCard>
            <StatCard label="Updated">
                <UpdatedCard row={row} />
            </StatCard>
        </div>
    );
}
