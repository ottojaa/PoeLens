import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AnimatedList, canAnimateLayout, MAX_ANIMATED_ITEMS } from './AnimatedList';
import { AnimatedNumber } from './AnimatedNumber';
import { countTo } from './number';
import { DURATION } from './tokens';

// Motion's frame loop reads requestAnimationFrame when it loads, and node has none, so this runs before the imports.
vi.hoisted(() => {
    globalThis.requestAnimationFrame = (callback: (time: number) => void) => setTimeout(() => callback(performance.now()), 8) as unknown as number;
    globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
});

describe('motion tokens', () => {
    const css = readFileSync(path.resolve(import.meta.dirname, 'motion.css'), 'utf8');

    it.each(Object.entries(DURATION))('%s is the same in CSS and in Motion', (name, seconds) => {
        const match = css.match(new RegExp(`--motion-${name}:\\s*(\\d+)ms`));

        expect(match, name).not.toBeNull();
        expect(Number(match?.[1]) / 1000).toBeCloseTo(seconds, 5);
    });

    it('draws charts in 600ms and pages in 180ms', () => {
        expect(DURATION.chart).toBe(0.6);
        expect(DURATION.page).toBe(0.18);
    });
});

describe('AnimatedNumber', () => {
    it('renders the final value for screen readers and the count for the eye', () => {
        const html = renderToString(createElement(AnimatedNumber, { value: 1234, format: (value: number) => value.toFixed(1) }));

        expect(html).toContain('1234.0');
        expect(html).toContain('sr-only');
    });
});

describe('countTo', () => {
    it('jumps straight to the value when motion is reduced', () => {
        const steps: string[] = [];

        countTo({ from: 1, to: 9, format: String, instant: true, onUpdate: (text) => steps.push(text) });

        expect(steps).toEqual(['9']);
    });

    it('counts through values in between and ends on the target', async () => {
        const steps: string[] = [];

        await new Promise<void>((resolve) => {
            countTo({ from: 0, to: 100, format: (value) => value.toFixed(0), instant: false, onUpdate: (text) => steps.push(text), onDone: resolve });
        });

        expect(steps.at(-1)).toBe('100');
        expect(steps.length).toBeGreaterThan(2);
        expect(steps.some((text) => Number(text) > 0 && Number(text) < 100)).toBe(true);
    });
});

describe('AnimatedList', () => {
    it('animates short lists only', () => {
        expect(canAnimateLayout(3)).toBe(true);
        expect(canAnimateLayout(MAX_ANIMATED_ITEMS)).toBe(true);
        expect(canAnimateLayout(MAX_ANIMATED_ITEMS + 1)).toBe(false);
    });

    it('renders every item', () => {
        const html = renderToString(
            createElement(AnimatedList<string>, {
                items: ['divine', 'exalted', 'chaos'],
                getKey: (item) => item,
                renderItem: (item) => createElement('span', null, item),
            }),
        );

        for (const name of ['divine', 'exalted', 'chaos']) expect(html).toContain(name);
    });
});
