import { describe, expect, it } from 'vitest';
import { COLOR_MODES, ColorModeSchema, DEFAULT_COLOR_MODE, DEFAULT_THEME_ID, THEME_IDS, ThemeIdSchema } from './themes.js';

describe('themes', () => {
    it('lists Reverie first, and it is the default', () => {
        expect(THEME_IDS).toEqual(['reverie', 'slate', 'graphite']);
        expect(DEFAULT_THEME_ID).toBe('reverie');
    });

    it('accepts only the known ids', () => {
        expect(ThemeIdSchema.safeParse('slate').success).toBe(true);
        expect(ThemeIdSchema.safeParse('gold').success).toBe(false);
    });

    it('has dark, light and system modes, and dark is the default', () => {
        expect(COLOR_MODES).toEqual(['dark', 'light', 'system']);
        expect(ColorModeSchema.safeParse(DEFAULT_COLOR_MODE).success).toBe(true);
        expect(ColorModeSchema.safeParse('auto').success).toBe(false);
    });
});
