import { GRID_COLUMNS } from './limits.js';

/** A rectangle on the panel grid: columns `x..x+w`, rows `y..y+h`. */
export interface GridRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface GridItem extends GridRect {
    id: string;
}

export function overlaps(a: GridRect, b: GridRect): boolean {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Fits a rectangle inside the grid's columns, with at least one cell. */
export function clampRect(rect: GridRect): GridRect {
    const w = Math.min(GRID_COLUMNS, Math.max(1, Math.round(rect.w)));
    const h = Math.max(1, Math.round(rect.h));
    const x = Math.min(GRID_COLUMNS - w, Math.max(0, Math.round(rect.x)));
    const y = Math.max(0, Math.round(rect.y));

    return { x, y, w, h };
}

function firstOverlap(rect: GridRect, placed: readonly GridRect[]): GridRect | undefined {
    return placed.find((other) => overlaps(rect, other));
}

/** Moves a rectangle down past whatever it overlaps, then up as far as nothing stops it. */
function settle(rect: GridRect, placed: readonly GridRect[]): GridRect {
    let result = rect;

    for (let hit = firstOverlap(result, placed); hit; hit = firstOverlap(result, placed)) {
        result = { ...result, y: hit.y + hit.h };
    }

    while (result.y > 0 && !firstOverlap({ ...result, y: result.y - 1 }, placed)) {
        result = { ...result, y: result.y - 1 };
    }

    return result;
}

function byPosition(a: GridRect, b: GridRect): number {
    return a.y - b.y || a.x - b.x;
}

/**
 * Lays items out from top to bottom, then left to right: each keeps its column, is pushed down past whatever it
 * overlaps, and floats up until something stops it. The result is in the input's order, so ordering never depends on
 * where a panel sits.
 *
 * `held` is the panel being dragged or resized: on a tie in row it goes first, so it wins the spot it was dropped on.
 */
function layOut<T extends GridItem>(items: readonly T[], held?: string): T[] {
    const ordered = items
        .map((item) => ({ item, rect: clampRect(item) }))
        .sort((a, b) => a.rect.y - b.rect.y || Number(b.item.id === held) - Number(a.item.id === held) || a.rect.x - b.rect.x);
    const placed = new Map<string, GridRect>();

    for (const { item, rect } of ordered) {
        placed.set(item.id, settle(rect, [...placed.values()]));
    }

    return items.map((item) => ({ ...item, ...placed.get(item.id) }));
}

/** Clamps every item to the grid, resolves overlaps and floats the items up. Idempotent. */
export function normalize<T extends GridItem>(items: readonly T[]): T[] {
    return layOut(items);
}

/** Where a new panel of this size goes: the left edge, below everything. */
export function place(items: readonly GridRect[], size: Pick<GridRect, 'w' | 'h'>): GridRect {
    const bottom = items.reduce((lowest, item) => Math.max(lowest, item.y + item.h), 0);

    return clampRect({ x: 0, y: bottom, ...size });
}

function withRect<T extends GridItem>(items: readonly T[], id: string, rect: GridRect): T[] {
    if (!items.some((item) => item.id === id)) return [...items];

    return layOut(
        items.map((item) => (item.id === id ? { ...item, ...rect } : item)),
        id,
    );
}

/** Puts a panel at a position; the others make room. A position the panel can't take is clamped. */
export function move<T extends GridItem>(items: readonly T[], id: string, to: Pick<GridRect, 'x' | 'y'>): T[] {
    const item = items.find((candidate) => candidate.id === id);

    return item ? withRect(items, id, { ...item, ...to }) : [...items];
}

/** Gives a panel a new size, keeping its corner; the others make room. */
export function resize<T extends GridItem>(items: readonly T[], id: string, to: Pick<GridRect, 'w' | 'h'>): T[] {
    const item = items.find((candidate) => candidate.id === id);

    return item ? withRect(items, id, { ...item, ...to }) : [...items];
}

/** A keyboard step: the panel moves by whole cells. */
export function nudge<T extends GridItem>(items: readonly T[], id: string, dx: number, dy: number): T[] {
    const item = items.find((candidate) => candidate.id === id);

    return item ? move(items, id, { x: item.x + dx, y: item.y + dy }) : [...items];
}

/** A keyboard step: the panel grows or shrinks by whole cells. */
export function stretch<T extends GridItem>(items: readonly T[], id: string, dw: number, dh: number): T[] {
    const item = items.find((candidate) => candidate.id === id);

    return item ? resize(items, id, { w: item.w + dw, h: item.h + dh }) : [...items];
}

/** The order panels stack in on a phone: top to bottom, then left to right. */
export function phoneOrder<T extends GridItem>(items: readonly T[]): T[] {
    return [...items].sort(byPosition);
}

/** The widest a panel can be and still take half a tablet's width. */
export const TABLET_HALF_MAX_COLUMNS = GRID_COLUMNS / 2;

/** One panel in the tablet flow: `span` is how many of the flow's two columns it takes. */
export interface TabletCell<T extends GridItem> {
    item: T;
    span: 1 | 2;
}

/**
 * The two-column flow a tablet shows instead of the grid: panels in `phoneOrder`, a panel at most half the grid wide
 * takes one column and a wider one the full row. Heights are not part of it, as each panel grows to fit its blocks.
 * Every panel is shown, whether or not it is hidden on a phone.
 */
export function tabletFlow<T extends GridItem>(items: readonly T[]): TabletCell<T>[] {
    return phoneOrder(items).map((item) => ({ item, span: item.w <= TABLET_HALF_MAX_COLUMNS ? 1 : 2 }));
}
