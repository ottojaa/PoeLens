// @vitest-environment happy-dom
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Header } from './Header';

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, ...props }: { children?: unknown }) => createElement('a', { href: '/', ...props }, children as never),
}));

vi.mock('@/lib/economy/use-economy-context', () => ({
    useEconomyContext: () => ({
        scope: { game: 'poe2', league: 'current', unit: 'exalted' },
        leagues: [{ name: 'Fate', hardcore: false }],
        league: { name: 'Fate', hardcore: false },
        setLeague: () => undefined,
        setUnit: () => undefined,
    }),
}));

// These need the auth and theme providers, which this test has no reason to build.
vi.mock('./AccountMenu', () => ({ AccountMenu: () => null }));
vi.mock('./ThemeToggle', () => ({ ThemeToggle: () => null }));

const BREAKPOINTS: Record<string, number> = { sm: 640, md: 768, lg: 1024 };
const DISPLAYS = new Set(['hidden', 'block', 'flex', 'inline', 'inline-flex', 'grid', 'contents']);
const HIDING = new Set(['hidden', 'sr-only', 'invisible']);

/** The width range a responsive variant covers, or undefined for a variant this test does not understand. */
function toRange(variant: string | undefined): { min: number; max: number } | undefined {
    if (variant === undefined) return { min: 0, max: Infinity };

    const min = BREAKPOINTS[variant];
    if (min !== undefined) return { min, max: Infinity };

    const max = variant.startsWith('max-') ? BREAKPOINTS[variant.slice(4)] : undefined;

    return max === undefined ? undefined : { min: 0, max };
}

/**
 * Whether Tailwind's responsive display classes leave the element on screen at the width: `hidden`, `sr-only` and
 * `invisible` hide it, and a larger breakpoint (or a `max-*` one, which wins ties) overrides a smaller one. It reads
 * classes because no layout engine is available here: the unit control was once unreachable because a wrapper said
 * `hidden lg:flex`. A variant it cannot read throws instead of passing silently.
 */
function isDisplayed(element: Element, width: number): boolean {
    let hidden = false;
    let rank = -1;

    for (const token of Array.from(element.classList)) {
        const parts = token.split(':');
        const utility = parts[parts.length - 1] ?? '';
        const isShowing = DISPLAYS.has(utility) && utility !== 'hidden';
        if (!HIDING.has(utility) && !isShowing && utility !== 'not-sr-only') continue;

        const range = toRange(parts.length > 1 ? parts[0] : undefined);
        if (parts.length > 2 || !range) throw new Error('Unreadable class in a visibility check: ' + token);
        if (width < range.min || width >= range.max) continue;

        const order = range.max === Infinity ? range.min : 10_000 - range.max;
        if (order < rank) continue;

        rank = order;
        hidden = HIDING.has(utility);
    }

    return !hidden;
}

function isVisibleAt(element: Element, width: number): boolean {
    for (let node: Element | null = element; node && node.tagName !== 'BODY'; node = node.parentElement) {
        if (!isDisplayed(node, width)) return false;
    }

    return true;
}

describe('Header controls without opening a menu', () => {
    beforeAll(() => {
        document.body.innerHTML = renderToString(createElement(Header, { onOpenMenu: () => undefined, onOpenSearch: () => undefined }));
    });

    const unitGroup = () => document.querySelector('[role="group"][aria-label="Price unit"]');
    const leagueButton = () => document.querySelector('button[aria-label^="League"]');

    it.each([360, 390, 800, 1023, 1440])('shows the unit picker at %i px', (width) => {
        const group = unitGroup();

        expect(group).not.toBeNull();
        expect(group && isVisibleAt(group, width)).toBe(true);
    });

    it('offers all three units, announcing the chosen one', () => {
        const buttons = Array.from(unitGroup()?.querySelectorAll('button') ?? []);

        expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['divine', 'exalted', 'chaos']);
        expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    });

    it.each([768, 800, 1023, 1440])('shows the league switcher at %i px', (width) => {
        const button = leagueButton();

        expect(button).not.toBeNull();
        expect(button && isVisibleAt(button, width)).toBe(true);
    });

    it('checks what it claims', () => {
        const cases: Array<[string, number, boolean]> = [
            ['hidden lg:flex', 800, false],
            ['hidden lg:flex', 1440, true],
            ['flex max-sm:hidden', 390, false],
            ['flex max-sm:hidden', 800, true],
            ['sr-only md:not-sr-only', 390, false],
            ['sr-only md:not-sr-only', 800, true],
            ['invisible', 800, false],
        ];

        for (const [classes, width, expected] of cases) {
            const element = document.createElement('div');
            element.className = classes;

            expect([classes, width, isVisibleAt(element, width)]).toEqual([classes, width, expected]);
        }
    });
});
