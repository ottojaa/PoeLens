import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
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
        expect(parseEnv({ NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@db:5432/poelens', JWT_SECRET: 'x'.repeat(32) }).DATABASE_URL).toBe(
            'postgres://u:p@db:5432/poelens',
        );
    });

    it('requires a JWT_SECRET of at least 32 characters in production, and defaults one elsewhere', () => {
        const production = { NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@db:5432/poelens' };

        expect(() => parseEnv(production)).toThrow(/JWT_SECRET/);
        expect(() => parseEnv({ ...production, JWT_SECRET: '' })).toThrow(/JWT_SECRET/);
        expect(() => parseEnv({ ...production, JWT_SECRET: 'x'.repeat(31) })).toThrow(/JWT_SECRET/);
        expect(parseEnv({ ...production, JWT_SECRET: 'x'.repeat(32) }).JWT_SECRET).toBe('x'.repeat(32));
        expect(parseEnv({}).JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    });

    it('rejects a malformed DATABASE_URL and an unknown NODE_ENV', () => {
        expect(() => parseEnv({ DATABASE_URL: 'not a url' })).toThrow();
        expect(() => parseEnv({ NODE_ENV: 'staging' })).toThrow();
    });

    it('leaves the collector off, with the repo as contact and no league list, unless told otherwise', () => {
        const env = parseEnv({});

        expect(env.COLLECTOR_ENABLED).toBe(false);
        expect(env.COLLECTOR_CONTACT).toBe('https://github.com/ottojaa/PoeLens');
        expect(env.COLLECTOR_LEAGUES).toEqual([]);
    });

    it('reads the collector switch and a comma-separated league list', () => {
        const env = parseEnv({ COLLECTOR_ENABLED: 'true', COLLECTOR_LEAGUES: ' Standard, HC Forbidden Rites ,' });

        expect(env.COLLECTOR_ENABLED).toBe(true);
        expect(env.COLLECTOR_LEAGUES).toEqual(['Standard', 'HC Forbidden Rites']);
        expect(() => parseEnv({ COLLECTOR_ENABLED: 'yes' })).toThrow();
    });
});

describe('the built env module, as production boots it', () => {
    const builtEnv = join(__dirname, '../../dist/apps/backend/src/config/env.js');

    function load(extra: Record<string, string>) {
        // ENV_FILE points at a file that does not exist, so a developer's own .env cannot supply the missing value.
        return spawnSync('node', ['-e', `require(${JSON.stringify(builtEnv)})`], {
            env: { PATH: process.env.PATH ?? '', ENV_FILE: 'no-such.env', NODE_ENV: 'production', DATABASE_URL: 'postgres://u:p@db:5432/poelens', ...extra },
            encoding: 'utf8',
        });
    }

    it('exits 1 and names JWT_SECRET when it is missing', () => {
        const result = load({});

        expect(result.status).toBe(1);
        expect(result.stderr).toMatch(/JWT_SECRET/);
    });

    it('starts with a long enough JWT_SECRET', () => {
        expect(load({ JWT_SECRET: 'y'.repeat(40) }).status).toBe(0);
    });
});
