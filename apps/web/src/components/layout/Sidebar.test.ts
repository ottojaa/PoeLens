// @vitest-environment happy-dom
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, to, ...props }: { children?: unknown; to: string }) => createElement('a', { href: to, ...props }, children as never),
    useParams: () => ({}),
    useRouterState: () => ({ location: { pathname: '/' } }),
}));

vi.mock('@/lib/api/watchlist', () => ({ useWatchlist: () => ({ count: 0, answer: undefined }) }));
vi.mock('@/lib/economy/use-economy-context', () => ({ GAME: 'poe2', useEconomyContext: () => ({}) }));
vi.mock('./LeagueSwitcher', () => ({ LeagueSwitcher: () => null }));

describe('Sidebar', () => {
    document.body.innerHTML = renderToString(createElement(Sidebar));
    const links = Array.from(document.querySelectorAll('nav a'));

    it('starts with the dashboard, which is the home page, and marks it current there', () => {
        const first = links[0];

        if (!first) throw new Error('No sidebar links rendered');

        expect(first.getAttribute('href')).toBe('/');
        expect(first.textContent).toBe('Dashboard');
        expect(first.getAttribute('aria-current')).toBe('page');
        expect(first.querySelector('svg')).not.toBeNull();
    });

    it('keeps the watchlist and the tokens under Yours, after every category', () => {
        const hrefs = links.map((link) => link.getAttribute('href'));

        expect(hrefs.filter((href) => href === '/')).toHaveLength(1);
        expect(hrefs.slice(-2)).toEqual(['/watchlist', '/tokens']);
    });
});
