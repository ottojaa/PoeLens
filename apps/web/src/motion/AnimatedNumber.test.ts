// @vitest-environment happy-dom
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimatedNumber } from './AnimatedNumber';

// The reduced-motion setting is a hook result, so the test owns it and flips it between renders.
const setting = vi.hoisted(() => ({ reduced: false }));

vi.mock('motion/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('motion/react')>()),
    useReducedMotion: () => setting.reduced,
}));

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

const format = (value: number) => String(Math.round(value));
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('AnimatedNumber in a DOM', () => {
    let root: Root | undefined;
    const container = document.createElement('div');

    afterEach(() => {
        act(() => root?.unmount());
        root = undefined;
        setting.reduced = false;
    });

    function render(value: number) {
        root ??= createRoot(container);
        act(() => root?.render(createElement(AnimatedNumber, { value, format })));
    }

    const shown = () => container.querySelector('[aria-hidden="true"]')?.textContent;

    it('counts to a new value', async () => {
        render(1);
        render(1000);
        await act(() => wait(700));

        expect(shown()).toBe('1000');
    });

    it('keeps counting when the reduced-motion setting changes half way', async () => {
        render(1);
        render(1000);
        await act(() => wait(120));

        const partway = Number(shown());

        expect(partway).toBeGreaterThan(1);
        expect(partway).toBeLessThan(1000);

        setting.reduced = true;
        render(1000);
        await act(() => wait(700));

        expect(shown()).toBe('1000');
    });
});
