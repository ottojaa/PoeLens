import AutoLoad from '@fastify/autoload';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import * as path from 'path';

// Everything in plugins/ and routes/ that autoload finds gets required at start-up, in production too. A test file
// there would pull in vitest, which the production image does not have, and the server would die at boot.
export const AUTOLOAD_IGNORE_PATTERN = /\.(?:test|spec)\.[cm]?[jt]s$/;

// Wrapped in fastify-plugin so decorators added by inner plugins are exposed on the root instance rather than staying
// in this plugin's encapsulated scope.
export const app = fp(async function app(fastify: FastifyInstance) {
    // Plugins load alphabetically; all of them are registered before any route.
    fastify.register(AutoLoad, {
        dir: path.join(__dirname, 'plugins'),
        ignorePattern: AUTOLOAD_IGNORE_PATTERN,
    });

    fastify.register(AutoLoad, {
        dir: path.join(__dirname, 'routes'),
        ignorePattern: AUTOLOAD_IGNORE_PATTERN,
    });
});
