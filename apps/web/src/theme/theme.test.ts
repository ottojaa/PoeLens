import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findThemeViolations } from './audit';
import { COLOR_TOKENS, DEFAULT_THEME_ID, FONT_TOKENS, THEMES, type ColorToken } from './themes';

const SRC = path.resolve(import.meta.dirname, '..');
const THEME_DIR = path.resolve(SRC, 'theme');

function read(file: string): string {
    return readFileSync(file, 'utf8');
}

/** Every file under `dir`, skipping what is not shipped source. */
function listFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);

        return statSync(full).isDirectory() ? listFiles(full) : [full];
    });
}

type Block = Map<string, string>;

/** Reads `selector { --token: value; }` blocks from a theme file. */
function parseBlocks(css: string): Map<string, Block> {
    const blocks = new Map<string, Block>();

    for (const [, selector, body] of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const tokens: Block = new Map();

        for (const [, name, value] of (body ?? '').matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) tokens.set(name ?? '', (value ?? '').trim());

        blocks.set((selector ?? '').trim(), tokens);
    }

    return blocks;
}

function channel(value: number): number {
    const unit = value / 255;

    return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
    const n = parseInt(hex.slice(1, 7), 16);

    return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

function contrast(a: string, b: string): number {
    const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);

    return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** [foreground, background]: text and controls must reach 4.5:1. */
const TEXT_PAIRS: [ColorToken, ColorToken][] = [
    ['foreground', 'background'],
    ['card-foreground', 'card'],
    ['popover-foreground', 'popover'],
    ['primary-foreground', 'primary'],
    ['secondary-foreground', 'secondary'],
    ['muted-foreground', 'background'],
    ['muted-foreground', 'card'],
    ['muted-foreground', 'muted'],
    ['accent-foreground', 'accent'],
    ['destructive-foreground', 'destructive'],
    ['destructive', 'background'],
    ['destructive', 'card'],
    ['primary', 'background'],
    ['primary', 'card'],
    ['up', 'background'],
    ['up', 'card'],
    ['down', 'background'],
    ['down', 'card'],
    ['success', 'background'],
    ['success', 'card'],
    ['warning', 'background'],
    ['warning', 'card'],
];

/** Graphics and focus rings must reach 3:1. */
const GRAPHIC_PAIRS: [ColorToken, ColorToken][] = [
    ['ring', 'background'],
    ['ring', 'card'],
    ...(['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] as const).flatMap((token): [ColorToken, ColorToken][] => [
        [token, 'card'],
        [token, 'background'],
    ]),
];

describe('theme files', () => {
    it('registers the default theme', () => {
        expect(THEMES.map((theme) => theme.id)).toContain(DEFAULT_THEME_ID);
    });

    describe.each(THEMES.map((theme) => theme.id))('%s', (id) => {
        const css = read(path.join(THEME_DIR, id + '.css'));
        const blocks = parseBlocks(css);
        const light = blocks.get(`[data-theme='${id}']`);
        const dark = blocks.get(`[data-theme='${id}'].dark`);

        it('has a light block and a dark block', () => {
            expect(light).toBeDefined();
            expect(dark).toBeDefined();
        });

        it.each([
            ['light', light],
            ['dark', dark],
        ])('defines every colour token in %s as a hex value', (_variant, block) => {
            for (const token of COLOR_TOKENS) expect(block?.get(token), token).toMatch(/^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i);
        });

        it('defines the fonts', () => {
            for (const token of FONT_TOKENS) expect(light?.get(token), token).toMatch(/\S/);
        });

        it.each([
            ['light', light],
            ['dark', dark],
        ])('keeps text and controls at 4.5:1 in %s', (_variant, block) => {
            for (const [fg, bg] of TEXT_PAIRS) {
                const ratio = contrast(block?.get(fg) ?? '#000000', block?.get(bg) ?? '#000000');

                expect(ratio, `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
            }
        });

        it.each([
            ['light', light],
            ['dark', dark],
        ])('keeps graphics and the focus ring at 3:1 in %s', (_variant, block) => {
            for (const [fg, bg] of GRAPHIC_PAIRS) {
                const ratio = contrast(block?.get(fg) ?? '#000000', block?.get(bg) ?? '#000000');

                expect(ratio, `${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
            }
        });

        it('is imported by styles.css', () => {
            expect(read(path.join(SRC, 'styles.css'))).toContain(`@import './theme/${id}.css';`);
        });
    });
});

describe('styles.css', () => {
    const styles = read(path.join(SRC, 'styles.css'));

    it('removes the built-in palette, so only theme colours exist', () => {
        expect(styles).toMatch(/--color-\*:\s*initial/);
    });

    it('exposes every colour token as a Tailwind colour', () => {
        for (const token of COLOR_TOKENS) expect(styles, token).toContain(`--color-${token}: var(--${token});`);
    });

    it('sets data-theme before the first paint, to the default theme', () => {
        const html = read(path.resolve(SRC, '../index.html'));

        expect(html).toContain(`'data-theme', '${DEFAULT_THEME_ID}'`);
    });
});

describe('the desktop shell', () => {
    it("paints its window in the default theme's dark background", () => {
        const dark = parseBlocks(read(path.join(THEME_DIR, DEFAULT_THEME_ID + '.css'))).get(`[data-theme='${DEFAULT_THEME_ID}'].dark`);
        const main = read(path.resolve(SRC, '../electron/main.mts'));

        expect(main).toContain(`WINDOW_BACKGROUND = '${dark?.get('background')}'`);
    });
});

describe('no colours or fonts outside src/theme', () => {
    it('catches a hex colour, a palette utility and a font family', () => {
        expect(findThemeViolations(`const accent = '#ff0000';`)).toHaveLength(1);
        expect(findThemeViolations(`<p className="text-white">x</p>`)).toHaveLength(1);
        expect(findThemeViolations(`<p className="dark:bg-zinc-900/60 border-black">x</p>`)).toHaveLength(2);
        expect(findThemeViolations(`<p className="bg-[#123456] text-[rgb(0,0,0)]">x</p>`).length).toBeGreaterThanOrEqual(2);
        expect(findThemeViolations(`const style = { fontFamily: 'Inter' };`)).toHaveLength(1);
        expect(findThemeViolations(`<p className="font-['Inter']">x</p>`)).toHaveLength(1);
    });

    it('leaves theme tokens alone', () => {
        expect(findThemeViolations(`<p className="text-foreground bg-card border-border text-up ring-ring/50 text-sm shadow-md">x</p>`)).toEqual([]);
    });

    const shipped = listFiles(SRC).filter((file) => {
        if (file.startsWith(THEME_DIR + path.sep) || /\.test\.tsx?$/.test(file) || file.endsWith('routeTree.gen.ts')) return false;

        return /\.(tsx?|css)$/.test(file);
    });

    it('scans the source files', () => {
        expect(shipped.length).toBeGreaterThan(10);
    });

    it.each(shipped.map((file) => [path.relative(SRC, file), file]))('%s', (_name, file) => {
        expect(findThemeViolations(read(file as string))).toEqual([]);
    });
});
