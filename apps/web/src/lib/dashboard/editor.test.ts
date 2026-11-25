import type { Panel } from '@poelens/shared';
import { describe, expect, it } from 'vitest';
import {
    draftReducer,
    fromTemplate,
    isDirty,
    newChartBlock,
    newHeadingBlock,
    newItemBlock,
    newMoversBlock,
    newPanel,
    newScreenerBlock,
    newTableBlock,
    toTableBlock,
    type Draft,
} from './editor';

function panel(id: string, y: number, extra: Partial<Panel> = {}): Panel {
    return { id, title: id, x: 0, y, w: 6, h: 4, hideOnPhone: false, unit: null, blocks: [], ...extra };
}

const draft: Draft = { name: 'Trading', panels: [panel('a', 0), panel('b', 4)] };

describe('draftReducer', () => {
    it('leaves the previous draft untouched', () => {
        const next = draftReducer(draft, { type: 'patchPanel', id: 'a', patch: { title: 'Rates' } });

        expect(next.panels[0]?.title).toBe('Rates');
        expect(draft.panels[0]?.title).toBe('a');
        expect(next.panels[1]).toBe(draft.panels[1]);
    });

    it('adds a panel below the others and floats the rest up when one is removed', () => {
        const added = draftReducer(draft, { type: 'addPanel', panel: newPanel(draft.panels)! });
        const removed = draftReducer(added, { type: 'removePanel', id: 'a' });

        expect(added.panels).toHaveLength(3);
        expect(added.panels[2]?.y).toBe(8);
        expect(removed.panels.find((candidate) => candidate.id === 'b')?.y).toBe(0);
    });

    it('adds, patches, reorders and removes blocks', () => {
        const first = newItemBlock(1);
        const second = newHeadingBlock();
        let state = draftReducer(draft, { type: 'addBlock', panelId: 'a', block: first });

        state = draftReducer(state, { type: 'addBlock', panelId: 'a', block: second });
        state = draftReducer(state, { type: 'moveBlock', panelId: 'a', from: 1, to: 0 });
        state = draftReducer(state, { type: 'patchBlock', panelId: 'a', blockId: second.id, patch: { text: 'Links' } });

        expect(state.panels[0]?.blocks.map((block) => block.id)).toEqual([second.id, first.id]);
        expect(state.panels[0]?.blocks[0]).toMatchObject({ type: 'heading', text: 'Links' });

        state = draftReducer(state, { type: 'removeBlock', panelId: 'a', blockId: first.id });

        expect(state.panels[0]?.blocks).toHaveLength(1);
    });

    it('refuses a thirteenth block', () => {
        let state = draft;

        for (let index = 0; index < 13; index += 1) state = draftReducer(state, { type: 'addBlock', panelId: 'a', block: newHeadingBlock() });

        expect(state.panels[0]?.blocks).toHaveLength(12);
    });

    it('knows whether it differs from what is stored', () => {
        const edited = draftReducer(draft, { type: 'rename', name: 'Crafting' });

        expect(isDirty(draft, draft)).toBe(false);
        expect(isDirty(edited, draft)).toBe(true);
    });
});

describe('the data block constructors', () => {
    it('build blocks with every setting at its default', () => {
        expect(newTableBlock('Currency')).toMatchObject({ type: 'table', category: 'Currency', sort: 'price', limit: 10 });
        expect(newMoversBlock()).toMatchObject({ type: 'movers', scope: { group: 'all' }, window: '24h' });
        expect(newScreenerBlock()).toMatchObject({ type: 'screener', windowHours: 3, minChangePct: 20, minLiquidity: 50, minDivine: 1 });
        expect(newChartBlock(7)).toMatchObject({ type: 'chart', item: 7, quote: null, range: '7d' });
    });

    it('patch a data block like any other', () => {
        const block = newScreenerBlock();
        const state = draftReducer(
            { name: 'T', panels: [panel('a', 0, { blocks: [block] })] },
            { type: 'patchBlock', panelId: 'a', blockId: block.id, patch: { direction: 'down', minDivine: null } },
        );

        expect(state.panels[0]?.blocks[0]).toMatchObject({ direction: 'down', minDivine: null, windowHours: 3 });
    });
});

describe('toTableBlock', () => {
    it('carries the economy view: sort, filter, columns and the cut to 20 rows', () => {
        const block = toTableBlock('UniqueArmours', { sort: 'd7', dir: 'asc', q: 'robe', min: 15, hideLow: false, columns: ['d7', 'trend'] });

        expect(block).toMatchObject({
            type: 'table',
            category: 'UniqueArmours',
            sort: 'd7',
            dir: 'asc',
            q: 'robe',
            minLiquidity: 15,
            hideLowConfidence: false,
            columns: ['d7', 'trend'],
            limit: 20,
        });
    });
});

describe('fromTemplate', () => {
    const template = { panel: panel('t', 0, { w: 6, h: 8, blocks: [newHeadingBlock(), newItemBlock(3)] }) };

    it('gives the panel and its blocks ids of their own, below the others', () => {
        const added = fromTemplate(template, draft.panels);

        expect(added?.id).not.toBe('t');
        expect(added?.y).toBe(8);
        expect(added?.blocks.map((block) => block.id)).not.toEqual(template.panel.blocks.map((block) => block.id));
        expect(added?.blocks.map((block) => block.type)).toEqual(['heading', 'item']);
    });

    it('adds the same template twice without sharing an id', () => {
        const first = fromTemplate(template, draft.panels);
        const second = fromTemplate(template, first ? [...draft.panels, first] : draft.panels);

        expect(second?.id).not.toBe(first?.id);
        expect(second?.blocks[0]?.id).not.toBe(first?.blocks[0]?.id);
    });

    it('is undefined when the dashboard is full', () => {
        const full = Array.from({ length: 24 }, (_, index) => panel('p' + index, index * 4));

        expect(fromTemplate(template, full)).toBeUndefined();
    });
});
