import { Kysely, PostgresDialect } from 'kysely';
import { env } from '../config/env.js';
import { createPool } from './pool.js';
import type { Database } from './schema.js';

export * from './schema.js';

export const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool: createPool(env.DATABASE_URL) }),
    log: ['error'],
});

export async function closeDb(): Promise<void> {
    await db.destroy();
}
