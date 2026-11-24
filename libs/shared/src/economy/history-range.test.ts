import { describe, expect, it } from 'vitest';
import { toHistoryWindow } from './history-range.js';

const NOW = new Date('2026-11-24T12:00:00.000Z');

describe('toHistoryWindow', () => {
    it('is hourly over a day and a week, and daily over a month', () => {
        expect(toHistoryWindow('24h', undefined, NOW)).toEqual({ bucket: 'hour', from: '2026-11-23T12:00:00.000Z' });
        expect(toHistoryWindow('7d', undefined, NOW)).toEqual({ bucket: 'hour', from: '2026-11-17T12:00:00.000Z' });
        expect(toHistoryWindow('30d', undefined, NOW)).toEqual({ bucket: 'day', from: '2026-10-25T12:00:00.000Z' });
    });

    it('is daily from the first sighting for the league, and nothing without one', () => {
        expect(toHistoryWindow('league', '2026-11-01T00:00:00.000Z', NOW)).toEqual({ bucket: 'day', from: '2026-11-01T00:00:00.000Z' });
        expect(toHistoryWindow('league', undefined, NOW)).toBeNull();
    });
});
