import { describe, expect, it } from 'vitest';
import { toChartPoints, toHistoryNotice } from './history';

const point = (time: string, price: number) => ({ time, price, low: price, high: price });

describe('toChartPoints', () => {
    it('gives each point its change from the one before', () => {
        const result = toChartPoints([point('2026-11-20T00:00:00.000Z', 100), point('2026-11-21T00:00:00.000Z', 150)]);

        expect(result.map((entry) => entry.change)).toEqual([null, 50]);
    });
});

describe('toHistoryNotice', () => {
    const base = { bucket: 'day', from: '2026-11-01T00:00:00.000Z' } as const;

    it('reports an empty range without inventing a start date', () => {
        expect(toHistoryNotice({ ...base, points: [] })).toEqual({ kind: 'empty' });
    });

    it('says collection started at the only point', () => {
        const notice = toHistoryNotice({ ...base, points: [point('2026-11-22T00:00:00.000Z', 1)] });

        expect(notice).toEqual({ kind: 'too-short', since: new Date('2026-11-22T00:00:00.000Z') });
    });

    it('flags a line that starts well after its range does', () => {
        const notice = toHistoryNotice({ ...base, points: [point('2026-11-20T00:00:00.000Z', 1), point('2026-11-21T00:00:00.000Z', 2)] });

        expect(notice.kind).toBe('partial');
    });

    it('has nothing to say about a full range', () => {
        const notice = toHistoryNotice({ ...base, points: [point('2026-11-01T00:00:00.000Z', 1), point('2026-11-02T00:00:00.000Z', 2)] });

        expect(notice).toEqual({ kind: 'none' });
    });
});
