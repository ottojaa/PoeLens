import type { Panel } from '@poelens/shared';
import { describe, expect, it } from 'vitest';
import { moveByPixels, resizeByPixels, toCells, toColumnWidth, toKeyStep } from './geometry';

function panel(id: string, x: number, y: number, w = 4, h = 4): Panel {
    return { id, title: id, x, y, w, h, hideOnPhone: false, unit: null, blocks: [] };
}

// 12 columns and 11 gaps of 16px: a 1200px grid has 85.33px columns.
const COLUMN = toColumnWidth(1200);

describe('grid geometry', () => {
    it('divides the grid into columns', () => {
        expect(COLUMN).toBeCloseTo((1200 - 11 * 16) / 12, 5);
    });

    it('turns pixels into whole cells', () => {
        expect(toCells(COLUMN + 16, 40, COLUMN)).toEqual({ cols: 1, rows: 1 });
        expect(toCells(10, 10, COLUMN)).toEqual({ cols: 0, rows: 0 });
        expect(toCells(-(COLUMN + 16) * 2, -80, COLUMN)).toEqual({ cols: -2, rows: -2 });
    });

    it('moves from the layout the drag started with, so going back undoes the push', () => {
        const start = [panel('a', 0, 0), panel('b', 4, 0)];
        const pushed = moveByPixels(start, 'a', COLUMN + 16, 0, COLUMN);
        const back = moveByPixels(start, 'a', 0, 0, COLUMN);

        expect(pushed.find((candidate) => candidate.id === 'a')?.x).toBe(1);
        expect(back).toEqual(start);
    });

    it('resizes by cells and keeps the corner', () => {
        const start = [panel('a', 2, 2)];
        const next = resizeByPixels(start, 'a', (COLUMN + 16) * 2, 80, COLUMN);

        expect(next[0]).toMatchObject({ x: 2, y: 2, w: 6, h: 6 });
    });

    it('maps arrows to steps and ignores other keys', () => {
        expect(toKeyStep('ArrowRight', false)).toEqual({ kind: 'move', dx: 1, dy: 0 });
        expect(toKeyStep('ArrowUp', true)).toEqual({ kind: 'resize', dx: 0, dy: -1 });
        expect(toKeyStep('a', false)).toBeUndefined();
    });
});
