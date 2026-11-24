import type { Panel } from '@poelens/shared';
import { describe, expect, it } from 'vitest';
import { draftReducer, isDirty, newHeadingBlock, newItemBlock, newPanel, type Draft } from './editor';

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
