import { createRequire } from 'node:module';
import Fastify from 'fastify';
import { SERVER_OPTIONS } from '../app/server-options.js';

const require = createRequire(__filename);

/**
 * Boots the app exactly as production does: the built `dist`, with every plugin and route autoloaded from disk.
 * (Autoload imports its files natively, which cannot load `.ts`, so it cannot run against `src`; the `test` target
 * depends on `build` for this.) Required lazily because `the built config/env.js` reads `process.env` on first load, so a
 * test sets DATABASE_URL first.
 */
export async function buildTestApp() {
    const { app } = require('../../dist/apps/backend/src/app/app.js') as typeof import('../app/app.js');
    const server = Fastify({ ...SERVER_OPTIONS });

    server.register(app);
    await server.ready();

    return server;
}
