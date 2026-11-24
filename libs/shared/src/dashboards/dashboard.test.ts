import { describe, expect, it } from 'vitest';
import type { Block } from './blocks.js';
import { DashboardDataBodySchema, DashboardOrderBodySchema, type Panel, PanelsSchema, SaveDashboardBodySchema } from './dashboard.js';
import { toDataPanels } from './data-request.js';
import { MAX_BLOCKS, MAX_DASHBOARDS, MAX_PANELS } from './limits.js';

function note(id: string, markdown = 'hi'): Block {
    return { id, type: 'note', v: 1, markdown };
}

function item(id: string, itemId: number, name?: string): Block {
    return { id, type: 'item', v: 1, item: itemId, display: 'compact', ...(name ? { name } : {}) };
}

function panel(id: string, blocks: Block[], overrides: Partial<Panel> = {}): Panel {
    return { id, title: id, x: 0, y: 0, w: 6, h: 4, hideOnPhone: false, unit: null, blocks, ...overrides };
}

describe('PanelsSchema', () => {
    it('accepts a dashboard at its caps', () => {
        const blocks = Array.from({ length: MAX_BLOCKS }, (_, index) => note('b' + index));
        const panels = Array.from({ length: MAX_PANELS }, (_, index) => panel('p' + index, index === 0 ? blocks : [], { y: index * 4 }));

        expect(PanelsSchema.safeParse(panels).success).toBe(true);
    });

    it('refuses one panel too many and one block too many', () => {
        const panels = Array.from({ length: MAX_PANELS + 1 }, (_, index) => panel('p' + index, []));
        const blocks = Array.from({ length: MAX_BLOCKS + 1 }, (_, index) => note('b' + index));

        expect(PanelsSchema.safeParse(panels).success).toBe(false);
        expect(PanelsSchema.safeParse([panel('p', blocks)]).success).toBe(false);
    });

    it('refuses repeated panel or block ids', () => {
        expect(PanelsSchema.safeParse([panel('p', []), panel('p', [])]).success).toBe(false);
        expect(PanelsSchema.safeParse([panel('a', [note('x')]), panel('b', [note('x')])]).success).toBe(false);
    });

    it('refuses a panel that runs past the grid', () => {
        expect(PanelsSchema.safeParse([panel('p', [], { x: 8, w: 6 })]).success).toBe(false);
    });

    it('refuses a title that is too long', () => {
        expect(PanelsSchema.safeParse([panel('p', [], { title: 'x'.repeat(61) })]).success).toBe(false);
    });
});

describe('request bodies', () => {
    it('needs a name and a revision to save', () => {
        const valid = { revision: 0, name: 'Trading', panels: [] };

        expect(SaveDashboardBodySchema.safeParse(valid).success).toBe(true);
        expect(SaveDashboardBodySchema.safeParse({ ...valid, name: '  ' }).success).toBe(false);
        expect(SaveDashboardBodySchema.safeParse({ ...valid, revision: -1 }).success).toBe(false);
    });

    it('caps the tab order list', () => {
        const ids = Array.from({ length: MAX_DASHBOARDS + 1 }, () => '5e4d5a2e-1b7c-4c62-9b0c-2d3a3a4b5c6d');

        expect(DashboardOrderBodySchema.safeParse({ game: 'poe2', ids }).success).toBe(false);
    });

    it('refuses a data request with a repeated block id', () => {
        const block = { id: 'b', type: 'item', item: 1 };
        const body = { game: 'poe2', panels: [{ unit: null, blocks: [block, block] }] };

        expect(DashboardDataBodySchema.safeParse(body).success).toBe(false);
    });

    it('defaults the league to current', () => {
        const parsed = DashboardDataBodySchema.parse({ game: 'poe2', panels: [] });

        expect(parsed.league).toBe('current');
    });
});

describe('toDataPanels', () => {
    const base = [
        panel('b', [item('i2', 20), note('n1', 'one')], { x: 6, unit: 'divine' }),
        panel('a', [item('i1', 10, 'Div'), { id: 'p1', type: 'pair', v: 1, a: 1, b: 2 }]),
        panel('c', [note('n2')]),
    ];

    it('carries only data inputs, sorted by id, and drops panels without data', () => {
        expect(toDataPanels(base)).toEqual([
            {
                unit: null,
                blocks: [
                    { id: 'i1', type: 'item', item: 10 },
                    { id: 'p1', type: 'pair', a: 1, b: 2 },
                ],
            },
            { unit: 'divine', blocks: [{ id: 'i2', type: 'item', item: 20 }] },
        ]);
    });

    it('is unchanged by moving panels, typing in notes, renaming and reordering blocks', () => {
        const before = JSON.stringify(toDataPanels(base));
        const changed = [
            panel('c', [note('n2', 'edited text')], { y: 9 }),
            panel('a', [{ id: 'p1', type: 'pair', v: 1, a: 1, b: 2, name: 'Rate' }, item('i1', 10, 'Renamed')], {
                title: 'New',
                x: 3,
                y: 5,
                w: 9,
                h: 2,
                hideOnPhone: true,
            }),
            panel('b', [note('n1', 'two'), item('i2', 20)], { x: 0, y: 2, unit: 'divine' }),
        ];

        expect(JSON.stringify(toDataPanels(changed))).toBe(before);
    });

    it('changes when an item, a pair or a unit changes', () => {
        const before = JSON.stringify(toDataPanels(base));

        expect(JSON.stringify(toDataPanels([panel('b', [item('i2', 21)], { unit: 'divine' }), base[1]!]))).not.toBe(before);
        expect(JSON.stringify(toDataPanels([panel('b', [item('i2', 20)], { unit: 'chaos' }), base[1]!]))).not.toBe(before);
    });
});
