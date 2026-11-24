import {
    MAX_BLOCKS,
    MAX_PANELS,
    normalize,
    place,
    type Block,
    type Dashboard,
    type HeadingBlock,
    type ItemBlock,
    type NoteBlock,
    type PairBlock,
    type Panel,
} from '@poelens/shared';
import { produce } from 'immer';

/** What an edit changes: the dashboard's name and its panels. The revision and position stay with the stored dashboard. */
export interface Draft {
    name: string;
    panels: Panel[];
}

export type PanelPatch = Partial<Pick<Panel, 'title' | 'unit' | 'hideOnPhone'>>;

export type BlockPatch = Partial<Pick<ItemBlock, 'name' | 'display' | 'item'>> &
    Partial<Pick<PairBlock, 'a' | 'b'>> &
    Partial<Pick<NoteBlock, 'markdown'>> &
    Partial<Pick<HeadingBlock, 'text'>>;

export type DraftAction =
    | { type: 'reset'; draft: Draft }
    | { type: 'rename'; name: string }
    /** The panels as a gesture or a keyboard step laid them out. */
    | { type: 'layout'; panels: Panel[] }
    | { type: 'addPanel'; panel: Panel }
    | { type: 'removePanel'; id: string }
    | { type: 'patchPanel'; id: string; patch: PanelPatch }
    | { type: 'addBlock'; panelId: string; block: Block }
    | { type: 'patchBlock'; panelId: string; blockId: string; patch: BlockPatch }
    | { type: 'removeBlock'; panelId: string; blockId: string }
    | { type: 'moveBlock'; panelId: string; from: number; to: number };

/** The size a new panel starts at, in grid columns and rows. */
export const NEW_PANEL_SIZE = { w: 6, h: 10 } as const;

export function toDraft(dashboard: Pick<Dashboard, 'name' | 'panels'>): Draft {
    return { name: dashboard.name, panels: dashboard.panels };
}

/** A fresh id for a panel or block: unique within a dashboard in practice, and valid for the schema. */
export function newId(prefix: string): string {
    return prefix + '-' + crypto.randomUUID().replace(/-/g, '').slice(0, 10);
}

/** An empty panel at the bottom of the grid, or undefined when the dashboard already holds as many as it can. */
export function newPanel(panels: readonly Panel[]): Panel | undefined {
    if (panels.length >= MAX_PANELS) return undefined;

    return { id: newId('panel'), title: 'New panel', ...place(panels, NEW_PANEL_SIZE), hideOnPhone: false, unit: null, blocks: [] };
}

export function newItemBlock(item: number): ItemBlock {
    return { id: newId('b'), type: 'item', v: 1, item, display: 'compact' };
}

export function newPairBlock(a: number, b: number): PairBlock {
    return { id: newId('b'), type: 'pair', v: 1, a, b };
}

export function newNoteBlock(): NoteBlock {
    return { id: newId('b'), type: 'note', v: 1, markdown: '' };
}

export function newHeadingBlock(): HeadingBlock {
    return { id: newId('b'), type: 'heading', v: 1, text: '' };
}

/** Whether a panel can take one more block. */
export function hasRoomForBlock(panel: Pick<Panel, 'blocks'>): boolean {
    return panel.blocks.length < MAX_BLOCKS;
}

function findPanel(draft: Draft, id: string): Panel | undefined {
    return draft.panels.find((panel) => panel.id === id);
}

/** Applies one edit. Immer keeps the previous draft untouched, so React sees a new object only where something changed. */
export function draftReducer(state: Draft, action: DraftAction): Draft {
    if (action.type === 'reset') return action.draft;

    return produce(state, (draft) => {
        switch (action.type) {
            case 'rename':
                draft.name = action.name;

                return;
            case 'layout':
                draft.panels = action.panels;

                return;
            case 'addPanel':
                draft.panels = normalize([...draft.panels, action.panel]);

                return;
            case 'removePanel':
                draft.panels = normalize(draft.panels.filter((panel) => panel.id !== action.id));

                return;

            case 'patchPanel': {
                const panel = findPanel(draft, action.id);

                if (panel) Object.assign(panel, action.patch);

                return;
            }

            case 'addBlock': {
                const panel = findPanel(draft, action.panelId);

                if (panel && hasRoomForBlock(panel)) panel.blocks.push(action.block);

                return;
            }

            case 'patchBlock': {
                const block = findPanel(draft, action.panelId)?.blocks.find((candidate) => candidate.id === action.blockId);

                if (block) Object.assign(block, action.patch);

                return;
            }

            case 'removeBlock': {
                const panel = findPanel(draft, action.panelId);

                if (panel) panel.blocks = panel.blocks.filter((block) => block.id !== action.blockId);

                return;
            }

            case 'moveBlock': {
                const panel = findPanel(draft, action.panelId);
                const [moved] = panel?.blocks.splice(action.from, 1) ?? [];

                if (panel && moved) panel.blocks.splice(action.to, 0, moved);

                return;
            }
        }
    });
}

/** Whether the draft differs from the stored dashboard. */
export function isDirty(draft: Draft, stored: Pick<Dashboard, 'name' | 'panels'>): boolean {
    return draft.name !== stored.name || JSON.stringify(draft.panels) !== JSON.stringify(stored.panels);
}
