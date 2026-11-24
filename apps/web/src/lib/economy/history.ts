import type { HistoryBucket, HistoryResponse } from '@poelens/shared';

const BUCKET_MS: Record<HistoryBucket, number> = { hour: 3_600_000, day: 86_400_000 };

export interface ChartPoint {
    /** Epoch milliseconds, the chart's x value. */
    time: number;
    price: number;
    /** Percent change from the previous point, null for the first. */
    change: number | null;
}

/** History points as chart data, each with its change from the point before. */
export function toChartPoints(points: HistoryResponse['points']): ChartPoint[] {
    return points.map((point, index) => {
        const previous = points[index - 1];
        const change = previous && previous.price > 0 ? ((point.price - previous.price) / previous.price) * 100 : null;

        return { time: new Date(point.time).getTime(), price: point.price, change };
    });
}

export type HistoryNotice =
    | { kind: 'none' }
    /** Too few points for a line: say when collection started instead of drawing one. */
    | { kind: 'too-short'; since: Date }
    /** A line, but history starts after the range does. */
    | { kind: 'partial'; since: Date };

/**
 * Whether a history answer is thin. Fewer than two points cannot make a line, and a first point more than one bucket
 * after the range start means the item has not been collected for the whole range; both say "Collecting since".
 * `fallbackSince` is when the item was first seen at all, for an answer with no points.
 */
export function toHistoryNotice(history: Pick<HistoryResponse, 'points' | 'from' | 'bucket'>, fallbackSince: Date): HistoryNotice {
    const first = history.points[0];

    if (!first) return { kind: 'too-short', since: fallbackSince };

    const since = new Date(first.time);

    if (history.points.length < 2) return { kind: 'too-short', since };

    const lateBy = since.getTime() - new Date(history.from).getTime();

    return lateBy > BUCKET_MS[history.bucket] ? { kind: 'partial', since } : { kind: 'none' };
}
