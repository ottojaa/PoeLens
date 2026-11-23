import { config } from 'dotenv';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { parseEnv, type Env } from './env-schema.js';

// Load the env file from the repo root regardless of cwd or build layout: __dirname differs between tsx runs
// (apps/backend/src/config) and the esbuild output, so walk upward until the file is found instead of hardcoding the
// depth. ENV_FILE can override (e.g. .env.prod) when set before import. Variables already in the environment win.
function findUp(name: string, from: string): string | undefined {
    let dir = from;

    for (;;) {
        const candidate = join(dir, name);

        if (existsSync(candidate)) return candidate;

        const parent = dirname(dir);

        if (parent === dir) return undefined;

        dir = parent;
    }
}

function loadEnv(): Env {
    const envFile = process.env.ENV_FILE || '.env';

    config({ path: findUp(envFile, __dirname) ?? join(process.cwd(), envFile) });

    try {
        return parseEnv(process.env);
    } catch (error) {
        console.error('Invalid environment variables:', error);
        process.exit(1);
    }
}

export const env = loadEnv();
