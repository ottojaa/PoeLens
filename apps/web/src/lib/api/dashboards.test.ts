import type { Panel, TableBlock } from '@poelens/shared';
import { describe, expect, it } from 'vitest';
import { toDataBody, toDataKey } from './dashboards';

const scope = { game: 'poe2', league: 'current', unit: 'auto' } as const;

function panel(overrides: Partial<Panel> = {}): Panel {
    return {
        id: 'p1',
        title: 'Rates',
        x: 0,
        y: 0,
        w: 6,
        h: 8,
        hideOnPhone: false,
        unit: null,
        blocks: [
            { id: 'b1', type: 'item', v: 1, item: 10, display: 'compact' },
            { id: 'b2', type: 'pair', v: 1, a: 10, b: 11 },
            { id: 'b3', type: 'note', v: 1, markdown: 'hello' },
        ],
        ...overrides,
    };
}

const keyOf = (panels: Panel[], unit: 'auto' | 'divine' = 'auto') => JSON.stringify(toDataKey(toDataBody({ ...scope, unit }, panels)));

describe('dashboard data key', () => {
    it('ignores note text, display names, titles, positions and sizes', () => {
        const base = keyOf([panel()]);
        const edited = panel({
            title: 'Renamed',
            x: 3,
            y: 5,
            w: 9,
            h: 12,
            blocks: [
                { id: 'b1', type: 'item', v: 1, item: 10, display: 'compact', name: 'My orb' },
                { id: 'b2', type: 'pair', v: 1, a: 10, b: 11, name: 'My pair' },
                { id: 'b3', type: 'note', v: 1, markdown: 'something else entirely' },
            ],
        });

        expect(keyOf([edited])).toBe(base);
    });

    it('ignores the order of blocks and panels', () => {
        const other = panel({ id: 'p2', blocks: [{ id: 'b9', type: 'item', v: 1, item: 12, display: 'card' }] });
        const reversed = panel({ blocks: [...panel().blocks].reverse() });

        expect(keyOf([reversed, other])).toBe(keyOf([panel(), other]));
        expect(keyOf([other, panel()])).toBe(keyOf([panel(), other]));
    });

    it('changes with the header unit, a panel unit, an item and the league', () => {
        const base = keyOf([panel()]);

        expect(keyOf([panel()], 'divine')).not.toBe(base);
        expect(keyOf([panel({ unit: 'chaos' })])).not.toBe(base);
        expect(keyOf([panel({ blocks: [{ id: 'b1', type: 'item', v: 1, item: 99, display: 'compact' }] })])).not.toBe(base);
        expect(JSON.stringify(toDataKey(toDataBody({ ...scope, league: 'Standard' }, [panel()])))).not.toBe(base);
    });
});

describe('dashboard data key of the data blocks', () => {
    it("ignores a table's columns and every data block's name, and changes with its settings", () => {
        const table: TableBlock = {
            id: 't',
            type: 'table',
            v: 1,
            category: 'Currency',
            sort: 'price',
            dir: 'desc',
            q: '',
            minLiquidity: 0,
            hideLowConfidence: true,
            columns: ['d7'],
            limit: 10,
        };
        const base = keyOf([panel({ blocks: [table] })]);

        expect(keyOf([panel({ blocks: [{ ...table, columns: ['h1', 'trend'], name: 'Mine' }] })])).toBe(base);
        expect(keyOf([panel({ blocks: [{ ...table, sort: 'd7' }] })])).not.toBe(base);
        expect(keyOf([panel({ blocks: [{ ...table, limit: 11 }] })])).not.toBe(base);
    });
});
