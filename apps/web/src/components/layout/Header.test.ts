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

/**
 * Whether Tailwind's responsive display classes on this element leave it displayed at the width. It reads the classes
 * because a layout engine is not available here: the unit control was once unreachable because a wrapper said
 * `hidden lg:flex`.
 */
function isDisplayed(element: Element, width: number): boolean {
    let display = 'inline';
    let tier = -1;

    for (const token of Array.from(element.classList)) {
        const [variant, utility] = token.includes(':') ? token.split(':') : [undefined, token];

        if (!utility || !DISPLAYS.has(utility)) continue;

        const min = variant === undefined ? 0 : (BREAKPOINTS[variant] ?? Infinity);

        if (width < min || min < tier) continue;

        tier = min;
        display = utility;
    }

    return display !== 'hidden';
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

    it('checks what it claims: a control hidden below lg is not visible at 800 px', () => {
        const wrapper = document.createElement('div');
        wrapper.className = 'hidden lg:flex';

        expect(isVisibleAt(wrapper, 800)).toBe(false);
        expect(isVisibleAt(wrapper, 1440)).toBe(true);
    });
});
