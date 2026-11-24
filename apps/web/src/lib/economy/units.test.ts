import { describe, expect, it } from 'vitest';
import { resolveUnit } from './units';

describe('resolveUnit', () => {
    it('prefers the URL, then the stored choice, then Auto', () => {
        expect(resolveUnit('chaos', 'divine')).toBe('chaos');
        expect(resolveUnit(undefined, 'divine')).toBe('divine');
        expect(resolveUnit(undefined, undefined)).toBe('auto');
    });
});
