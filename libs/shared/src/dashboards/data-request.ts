import type { Block, DataBlock } from './blocks.js';
import { toDataBlock } from './blocks.js';
import type { DataPanel, Panel } from './dashboard.js';

function byId(a: { id: string }, b: { id: string }): number {
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function toDataBlocks(blocks: readonly Block[]): DataBlock[] {
    return blocks.flatMap((block) => toDataBlock(block) ?? []).sort(byId);
}

/**
 * The data a set of panels needs: each panel's unit and its blocks' data inputs, and nothing else. Panels and blocks come
 * out sorted by id and panels without data blocks are left out, so moving, resizing or renaming panels, typing in a note
 * and reordering blocks all give the same request, which is also the page's query key.
 */
export function toDataPanels(panels: readonly Pick<Panel, 'id' | 'unit' | 'blocks'>[]): DataPanel[] {
    return [...panels]
        .sort(byId)
        .map((panel) => ({ unit: panel.unit, blocks: toDataBlocks(panel.blocks) }))
        .filter((panel) => panel.blocks.length > 0);
}
