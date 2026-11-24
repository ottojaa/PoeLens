import type { HistoryResponse } from '@poelens/shared';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { toChartPoints, toHistoryNotice, type HistoryNotice } from '@/lib/economy/history';
import { RANGES, type Range } from '@/lib/economy/search-params';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { HistoryChart } from './HistoryChart';

const RANGE_LABELS: Record<Range, string> = { '24h': '24 hours', '7d': '7 days', '30d': '30 days', league: 'League' };

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

function NoticeLine({ notice }: { notice: HistoryNotice }) {
    if (notice.kind === 'none') return null;

    const text =
        notice.kind === 'empty'
            ? 'No confident prices in this range yet.'
            : `Collecting since ${formatDate(notice.since)}${notice.kind === 'too-short' ? ': not enough points to draw a line yet.' : '.'}`;

    return (
        <p role="status" className="text-muted-foreground text-sm">
            {text}
        </p>
    );
}

/** The price history of one item: the range picker, a "Collecting since" note when the data is thin, and the chart. */
export function HistoryCard({
    history,
    itemName,
    range,
    onRange,
}: {
    /** Undefined while the answer for this item, league and range loads. */
    history: HistoryResponse | undefined;
    itemName: string;
    range: Range;
    onRange: (range: Range) => void;
}) {
    const points = useMemo(() => (history ? toChartPoints(history.points) : []), [history]);
    const notice = history ? toHistoryNotice(history) : { kind: 'none' as const };
    const drawsLine = history && (notice.kind === 'none' || notice.kind === 'partial');

    return (
        <Card className="gap-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-heading text-lg font-semibold">Price history</h2>
                <RangeToggle value={range} onChange={onRange} />
            </div>
            <NoticeLine notice={notice} />
            {!history && <Skeleton className="h-72 w-full" />}
            {drawsLine && (
                <HistoryChart
                    points={points}
                    bucket={history.bucket}
                    unit={history.unit}
                    label={`${itemName} price in ${history.unit} over ${RANGE_LABELS[range]}`}
                />
            )}
        </Card>
    );
}
