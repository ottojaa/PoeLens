import { type Unit, UNITS } from '@poelens/shared';
import { Link, useNavigate } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useHistory, useLatest, useLeagues } from '@/lib/api/prices';
import { ApiError } from '@/lib/api/client';
import { toChartPoints, toHistoryNotice } from '@/lib/economy/history';
import { RANGES, type Range } from '@/lib/economy/search-params';
import { GAME, useEconomyContext } from '@/lib/economy/use-economy-context';
import { UNIT_SHORT } from '@/lib/economy/units';
import { formatAgo, formatCount, formatDate, formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from '@/motion/AnimatedNumber';
import { Change } from './Change';
import { HistoryChart } from './HistoryChart';
import { ItemIcon } from './ItemIcon';
import { ErrorState } from './states';
import { CATEGORIES } from '@poelens/shared';

const RANGE_LABELS: Record<Range, string> = { '24h': '24 hours', '7d': '7 days', '30d': '30 days', league: 'League' };

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <Card className="bg-card gap-1.5 rounded-xl px-5 py-[18px]">
            <span className="text-muted-foreground text-[13px]">{label}</span>
            {children}
        </Card>
    );
}

/** The item's price in the other two units, small, under the large one. */
function OtherUnits({ itemId, unit, prices }: { itemId: number; unit: Unit; prices: Partial<Record<Unit, number>> }) {
    const others = UNITS.filter((candidate) => candidate !== unit);

    return (
        <div className="text-muted-foreground flex flex-wrap gap-x-4 text-sm" data-item={itemId}>
            {others.map((other) => (
                <span key={other}>
                    {prices[other] === undefined ? '…' : formatPrice(prices[other])} {UNIT_SHORT[other]}
                </span>
            ))}
        </div>
    );
}

function RangeToggle({ value, onChange }: { value: Range; onChange: (range: Range) => void }) {
    return (
        <div role="group" aria-label="History range" className="border-input flex gap-0.5 rounded-[10px] border p-[3px]">
            {RANGES.map((range) => (
                <Button
                    key={range}
                    type="button"
                    variant={range === value ? 'default' : 'ghost'}
                    size="sm"
                    aria-pressed={range === value}
                    onClick={() => onChange(range)}
                    className={cn('h-8 rounded-lg px-3', range !== value && 'text-muted-foreground')}
                >
                    {RANGE_LABELS[range]}
                </Button>
            ))}
        </div>
    );
}

/** One item: its price in all three units, how it moved, and its history over a chosen range. */
export function ItemPage({ itemId, range }: { itemId: number; range: Range }) {
    const { scope, leagueName, setUnit: _setUnit } = useEconomyContext();
    const navigate = useNavigate();
    const leagues = useLeagues(GAME);
    const leagueFirstSeen = leagues.data?.leagues.find((league) => league.name === leagueName)?.firstSeen;
    const history = useHistory(scope, itemId, range, leagueFirstSeen);
    // One cached `latest` query per unit: the chosen one is large, the other two sit small beneath it.
    const divine = useLatest({ ...scope, unit: 'divine' }, [itemId], { refresh: true });
    const exalted = useLatest({ ...scope, unit: 'exalted' }, [itemId], { refresh: true });
    const chaos = useLatest({ ...scope, unit: 'chaos' }, [itemId], { refresh: true });
    const byUnit = { divine, exalted, chaos };
    const row = byUnit[scope.unit].data?.rows[0];
    const prices = Object.fromEntries(UNITS.flatMap((unit) => (byUnit[unit].data?.rows[0] ? [[unit, byUnit[unit].data.rows[0].price]] : [])));
    const item = history.data?.item ?? row?.item;
    const chartPoints = useMemo(() => (history.data ? toChartPoints(history.data.points) : []), [history.data]);
    const category = CATEGORIES[GAME].find((candidate) => candidate.id === item?.category);

    if (history.isError && !history.data) {
        const missing = history.error instanceof ApiError && history.error.status === 404;

        if (missing) return <ErrorState title="This item does not exist" message="Check the link, or find the item with the search (Ctrl+K or ⌘K)." />;

        return <ErrorState title="Could not load this item" onRetry={() => void history.refetch()} />;
    }

    if (!item) return <ItemSkeleton />;

    const fallbackSince = new Date(row?.asOf ?? Date.now());
    const notice = history.data ? toHistoryNotice(history.data, fallbackSince) : { kind: 'none' as const };
    const from = row && row.change.d7 !== null ? row.price / (1 + row.change.d7 / 100) : null;

    return (
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
            <nav aria-label="Breadcrumb" className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <Link
                    to="/economy/$category"
                    params={{ category: item.category }}
                    className="hover:text-foreground rounded-sm underline-offset-4 hover:underline"
                >
                    {category?.label ?? item.category}
                </Link>
                <ChevronRight className="size-3.5" aria-hidden="true" />
                <span className="text-foreground" aria-current="page">
                    {item.name}
                </span>
            </nav>
            <div className="flex items-center gap-4">
                <ItemIcon item={item} size="lg" />
                <div>
                    <h1 className="font-heading text-[38px] leading-tight font-bold tracking-[-0.03em]">{item.name}</h1>
                    <p className="text-muted-foreground text-sm">{[item.baseType, category?.label ?? item.category].filter(Boolean).join(' · ')}</p>
                </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
                <StatCard label="Price">
                    {row ? (
                        <>
                            <span className="font-heading text-[32px] leading-tight font-bold tracking-[-0.02em]">
                                <AnimatedNumber key={`${scope.league}:${scope.unit}`} value={row.price} format={formatPrice} />
                                <span className="text-muted-foreground ml-1.5 text-base font-medium">{UNIT_SHORT[scope.unit]}</span>
                            </span>
                            <OtherUnits itemId={itemId} unit={scope.unit} prices={prices} />
                        </>
                    ) : (
                        <Skeleton className="h-9 w-32" />
                    )}
                </StatCard>
                <StatCard label="Change, 7 days">
                    {row ? (
                        <>
                            <Change percent={row.change.d7} className="font-heading text-[32px] leading-tight font-bold tracking-[-0.02em]" />
                            <span className="text-muted-foreground text-sm">
                                {from === null ? 'Not enough history yet' : `from ${formatPrice(from)} ${UNIT_SHORT[scope.unit]}`}
                            </span>
                        </>
                    ) : (
                        <Skeleton className="h-9 w-32" />
                    )}
                </StatCard>
                <StatCard label={row?.liquidity?.kind === 'listings' ? 'Listings' : 'Volume'}>
                    {row ? (
                        <span className="font-heading text-[32px] leading-tight font-bold tracking-[-0.02em]">
                            {row.liquidity ? formatCount(row.liquidity.value) : '—'}
                        </span>
                    ) : (
                        <Skeleton className="h-9 w-24" />
                    )}
                    {row?.lowConfidence && <span className="text-warning text-sm">Low confidence: the price may be unreliable</span>}
                </StatCard>
                <StatCard label="Updated">
                    {row ? (
                        <span className="font-heading text-[32px] leading-tight font-bold tracking-[-0.02em]">{formatAgo(row.asOf)}</span>
                    ) : (
                        <Skeleton className="h-9 w-28" />
                    )}
                </StatCard>
            </div>
            <Card className="gap-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-heading text-lg font-semibold">Price history</h2>
                    <RangeToggle
                        value={range}
                        onChange={(next) =>
                            void navigate({ to: '.', replace: true, search: (previous) => ({ ...previous, range: next === '7d' ? undefined : next }) })
                        }
                    />
                </div>
                {notice.kind !== 'none' && (
                    <p role="status" className="text-muted-foreground text-sm">
                        Collecting since {formatDate(notice.since)}
                        {notice.kind === 'too-short' ? ': not enough points to draw a line yet.' : '.'}
                    </p>
                )}
                {history.isPending && <Skeleton className="h-72 w-full" />}
                {history.data && notice.kind !== 'too-short' && (
                    <HistoryChart
                        points={chartPoints}
                        bucket={history.data.bucket}
                        unit={scope.unit}
                        label={`${item.name} price in ${scope.unit} over ${RANGE_LABELS[range]}`}
                    />
                )}
            </Card>
        </div>
    );
}

function ItemSkeleton() {
    return (
        <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading item">
            <Skeleton className="h-4 w-48" />
            <div className="flex items-center gap-4">
                <Skeleton className="size-[60px] rounded-2xl" />
                <Skeleton className="h-8 w-64" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[0, 1, 2, 3].map((index) => (
                    <Skeleton key={index} className="h-24 rounded-xl" />
                ))}
            </div>
            <Skeleton className="h-96 rounded-xl" />
        </div>
    );
}
