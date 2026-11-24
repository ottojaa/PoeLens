import { readFileSync } from 'node:fs';
import path from 'node:path';
import { THEME_IDS } from '@poelens/shared';
import { describe, expect, it } from 'vitest';

const HTML = readFileSync(path.resolve(import.meta.dirname, '../../index.html'), 'utf8');
const SCRIPT = /<script>([\s\S]*?)<\/script>/.exec(HTML)?.[1] ?? '';

interface Page {
    theme: string | null;
    isDark: boolean;
    storage: Record<string, string>;
}

/** Runs index.html's inline script against a fake page, with the given localStorage and device colour scheme. */
function paint(storage: Record<string, string>, prefersDark = false): Page {
    const page: Page = { theme: null, isDark: false, storage: { ...storage } };
    const fakeDocument = {
        documentElement: {
            setAttribute: (name: string, value: string) => name === 'data-theme' && (page.theme = value),
            classList: { add: (name: string) => name === 'dark' && (page.isDark = true) },
        },
    };
    const fakeStorage = {
        getItem: (key: string) => page.storage[key] ?? null,
        setItem: (key: string, value: string) => void (page.storage[key] = value),
        removeItem: (key: string) => void delete page.storage[key],
    };

    new Function('document', 'localStorage', 'matchMedia', SCRIPT)(fakeDocument, fakeStorage, () => ({ matches: prefersDark }));

    return page;
}

describe('the first-paint script in index.html', () => {
    it('is found', () => {
        expect(SCRIPT).toContain('data-theme');
    });

    it('lists exactly the themes the API accepts', () => {
        const listed = /var THEMES = \[([^\]]*)\]/.exec(SCRIPT)?.[1] ?? '';

        expect(listed.match(/'([^']+)'/g)?.map((id) => id.slice(1, -1))).toEqual([...THEME_IDS]);
    });

    it('paints Reverie in dark on a first visit', () => {
        expect(paint({})).toMatchObject({ theme: 'reverie', isDark: true });
    });

    it.each(THEME_IDS)('paints the stored theme %s', (id) => {
        expect(paint({ 'poelens-theme': id, 'poelens-mode': 'light' })).toMatchObject({ theme: id, isDark: false });
    });

    it('paints dark and light as stored', () => {
        expect(paint({ 'poelens-mode': 'dark' }).isDark).toBe(true);
        expect(paint({ 'poelens-mode': 'light' }).isDark).toBe(false);
    });

    it('follows the device in System mode', () => {
        expect(paint({ 'poelens-mode': 'system' }, true).isDark).toBe(true);
        expect(paint({ 'poelens-mode': 'system' }, false).isDark).toBe(false);
    });

    it("keeps a browser's earlier light choice, which was stored as the theme, and moves it to the mode", () => {
        const page = paint({ 'poelens-theme': 'light' });

        expect(page).toMatchObject({ theme: 'reverie', isDark: false });
        expect(page.storage).toEqual({ 'poelens-mode': 'light' });
    });

    it('keeps an earlier dark choice too', () => {
        expect(paint({ 'poelens-theme': 'dark' })).toMatchObject({ theme: 'reverie', isDark: true });
    });

    it('does not let the earlier value override a mode that was chosen since', () => {
        expect(paint({ 'poelens-theme': 'light', 'poelens-mode': 'dark' }).isDark).toBe(true);
    });

    it('falls back to the defaults on values it does not know', () => {
        expect(paint({ 'poelens-theme': 'gold', 'poelens-mode': 'neon' })).toMatchObject({ theme: 'reverie', isDark: true });
    });
});
