import { GRID_COLUMNS, GRID_GAP_PX, GRID_ROW_PX, move, resize, type Panel } from '@poelens/shared';

/** The width of one grid column for a grid that is `gridWidth` pixels wide. */
export function toColumnWidth(gridWidth: number): number {
    return (gridWidth - (GRID_COLUMNS - 1) * GRID_GAP_PX) / GRID_COLUMNS;
}

/** How many whole cells a pointer travel of `dx` by `dy` pixels is, on a grid whose columns are `columnWidth` wide. */
export function toCells(dx: number, dy: number, columnWidth: number): { cols: number; rows: number } {
    return { cols: Math.round(dx / (columnWidth + GRID_GAP_PX)), rows: Math.round(dy / (GRID_ROW_PX + GRID_GAP_PX)) };
}

/**
 * The panels after a drag, worked out from the layout the drag started from and the pointer's total travel, never
 * from the layout of the previous frame: the others are moved out of the way and back again as the pointer goes, and
 * stepping from frame to frame would leave them wherever the last frame pushed them.
 */
export function moveByPixels(start: readonly Panel[], id: string, dx: number, dy: number, columnWidth: number): Panel[] {
    const panel = start.find((candidate) => candidate.id === id);

    if (!panel) return [...start];

    const { cols, rows } = toCells(dx, dy, columnWidth);

    return move(start, id, { x: panel.x + cols, y: panel.y + rows });
}

export function resizeByPixels(start: readonly Panel[], id: string, dx: number, dy: number, columnWidth: number): Panel[] {
    const panel = start.find((candidate) => candidate.id === id);

    if (!panel) return [...start];

    const { cols, rows } = toCells(dx, dy, columnWidth);

    return resize(start, id, { w: panel.w + cols, h: panel.h + rows });
}

const ARROWS: Record<string, readonly [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
};

export type KeyStep = { kind: 'move' | 'resize'; dx: number; dy: number };

/** What an arrow key does to a picked-up panel: it moves by a cell, or resizes by a cell with Shift. Any other key does nothing. */
export function toKeyStep(key: string, shift: boolean): KeyStep | undefined {
    const arrow = ARROWS[key];

    if (!arrow) return undefined;

    return { kind: shift ? 'resize' : 'move', dx: arrow[0], dy: arrow[1] };
}
