import { describe, expect, it } from 'vitest';
import { parsePreferences, PreferencesSchema } from './preferences.js';

describe('PreferencesSchema', () => {
    it('accepts a partial update, including none', () => {
        expect(PreferencesSchema.parse({})).toEqual({});
        expect(PreferencesSchema.parse({ mode: 'system' })).toEqual({ mode: 'system' });
    });

    it('refuses an unknown theme, mode or unit', () => {
        expect(PreferencesSchema.safeParse({ theme: 'gold' }).success).toBe(false);
        expect(PreferencesSchema.safeParse({ mode: 'auto' }).success).toBe(false);
        expect(PreferencesSchema.safeParse({ unit: 'mirror' }).success).toBe(false);
    });
});

describe('parsePreferences', () => {
    it('keeps valid values', () => {
        expect(parsePreferences({ theme: 'slate', mode: 'light', unit: 'auto' })).toEqual({ theme: 'slate', mode: 'light', unit: 'auto' });
    });

    it('drops a stale value without losing the others', () => {
        expect(parsePreferences({ theme: 'gold', mode: 'dark', unit: 'mirror' })).toEqual({ mode: 'dark' });
    });

    it('drops keys it does not know', () => {
        expect(parsePreferences({ theme: 'graphite', fontSize: 12 })).toEqual({ theme: 'graphite' });
    });

    it.each([null, undefined, 'slate', 7, ['slate']])('reads %j as no preferences', (raw) => {
        expect(parsePreferences(raw)).toEqual({});
    });
});
