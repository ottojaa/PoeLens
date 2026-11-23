import { describe, expect, it } from 'vitest';
import { GGG_DISCLAIMER } from './legal.js';

describe('GGG_DISCLAIMER', () => {
    // GGG's third-party notice has to appear verbatim; a "tidy-up" edit would break the requirement.
    it('is the notice GGG requires, word for word', () => {
        expect(GGG_DISCLAIMER).toBe("This product isn't affiliated with or endorsed by Grinding Gear Games in any way.");
    });
});
