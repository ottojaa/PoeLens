import type { HistoryBucket } from '../api/schemas/prices.js';

const DAY_MS = 24 * 3_600_000;

/** The ranges a price history can be shown over, shortest first. */
export const HISTORY_RANGES = ['24h', '7d', '30d', 'league'] as const;

export type HistoryRange = (typeof HISTORY_RANGES)[number];

export const RANGE_SPANS = {
    '24h': { bucket: 'hour', spanMs: DAY_MS },
    '7d': { bucket: 'hour', spanMs: 7 * DAY_MS },
    '30d': { bucket: 'day', spanMs: 30 * DAY_MS },
} as const satisfies Record<Exclude<HistoryRange, 'league'>, { bucket: HistoryBucket; spanMs: number }>;

/** The bucket and start of a history range. "League" is daily from the league's first sighting. */
export function toHistoryWindow(range: HistoryRange, leagueFirstSeen: string | undefined, now: Date): { bucket: HistoryBucket; from: string } | null {
    if (range === 'league') {
        if (!leagueFirstSeen) return null;

        return { bucket: 'day', from: leagueFirstSeen };
    }

    const { bucket, spanMs } = RANGE_SPANS[range];

    return { bucket, from: new Date(now.getTime() - spanMs).toISOString() };
}
