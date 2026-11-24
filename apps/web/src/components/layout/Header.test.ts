// @vitest-environment happy-dom
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, ...props }: { children?: unknown }) => createElement('a', { href: '/', ...props }, children as never),
}));

vi.mock('@/lib/economy/use-economy-context', () => ({
    useEconomyContext: () => ({
        scope: { game: 'poe2', league: 'current', unit: 'exalted' },
        leagues: [],
        league: undefined,
        setLeague: () => undefined,
        setUnit: () => undefined,
    }),
}));

// These need the auth and theme providers, which this test has no reason to build.
vi.mock('./AccountMenu', () => ({ AccountMenu: () => null }));
vi.mock('./ThemeToggle', () => ({ ThemeToggle: () => null }));

const HIDING = new Set(['hidden', 'sr-only', 'invisible']);

describe('Header unit picker', () => {
    document.body.innerHTML = renderToString(createElement(Header, { onOpenMenu: () => undefined, onOpenSearch: () => undefined }));
    const group = document.querySelector('[role="group"][aria-label="Price unit"]');

    it('offers all three units, announcing the chosen one', () => {
        const buttons = Array.from(group?.querySelectorAll('button') ?? []);

        expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['divine', 'exalted', 'chaos']);
        expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    });

    it('is never hidden at any width: no ancestor hides it, under any breakpoint', () => {
        const hiding: string[] = [];

        for (let node = group; node && node.tagName !== 'BODY'; node = node.parentElement) {
            for (const token of Array.from(node.classList)) {
                if (HIDING.has(token.split(':').pop() ?? '')) hiding.push(token);
            }
        }

        expect(group).not.toBeNull();
        expect(hiding).toEqual([]);
    });
});
