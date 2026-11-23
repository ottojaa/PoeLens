import { describe, expect, it } from 'vitest';
import { parseEnv } from './env-schema.js';

describe('parseEnv', () => {
    it('falls back to the dev compose database outside production, so a checkout with no .env boots', () => {
        const env = parseEnv({});

        expect(env.DATABASE_URL).toBe('postgres://poelens:poelens@localhost:5433/poelens');
        expect(env.PORT).toBe(3100);
        expect(env.CORS_ORIGIN).toBe('http://localhost:4300');
    });

    it('requires DATABASE_URL in production instead of defaulting to localhost', () => {
        expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL/);
        expect(parseEnv({ NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@db:5432/poelens' }).DATABASE_URL).toBe('postgres://u:p@db:5432/poelens');
    });

    it('rejects a malformed DATABASE_URL and an unknown NODE_ENV', () => {
        expect(() => parseEnv({ DATABASE_URL: 'not a url' })).toThrow();
        expect(() => parseEnv({ NODE_ENV: 'staging' })).toThrow();
    });
});
