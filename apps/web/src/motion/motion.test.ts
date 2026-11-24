import { readFileSync } from 'node:fs';
import path from 'node:path';
import { motionValue } from 'motion/react';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AnimatedList, canAnimateLayout, MAX_ANIMATED_ITEMS } from './AnimatedList';
import { AnimatedNumber } from './AnimatedNumber';
import { countTo, hasChanged } from './number';
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

describe('hasChanged', () => {
    it('is false on the first render and for the same value, true for a new one', () => {
        expect(hasChanged(null, 5)).toBe(false);
        expect(hasChanged(5, 5)).toBe(false);
        expect(hasChanged(5, 6)).toBe(true);
    });
});

describe('countTo', () => {
    it('jumps straight to the value when motion is reduced', () => {
        const value = motionValue(1);

        countTo(value, 9, true);

        expect(value.get()).toBe(9);
    });

    it('counts through values in between and ends on the target', async () => {
        const value = motionValue(0);
        const seen: number[] = [];

        await new Promise<void>((resolve) => {
            value.on('change', (latest) => {
                seen.push(latest);

                if (latest === 100) resolve();
            });
            countTo(value, 100, false);
        });

        expect(seen.at(-1)).toBe(100);
        expect(seen.some((latest) => latest > 0 && latest < 100)).toBe(true);
    });

    it('continues from the number on screen when a count is interrupted', async () => {
        const value = motionValue(0);
        const stop = countTo(value, 100, false);

        await new Promise((resolve) => setTimeout(resolve, 150));
        stop();

        const onScreen = value.get();

        expect(onScreen).toBeGreaterThan(0);
        expect(onScreen).toBeLessThan(100);

        const seen: number[] = [];

        value.on('change', (latest) => seen.push(latest));
        const stopAgain = countTo(value, 50, false);

        await new Promise((resolve) => setTimeout(resolve, 60));
        stopAgain();

        // The first step moves toward 50 from where the count stopped, not from the old target of 100.
        expect(Math.abs(seen[0]! - onScreen)).toBeLessThan(30);
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
