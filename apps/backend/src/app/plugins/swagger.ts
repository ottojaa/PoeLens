import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { jsonSchemaTransform } from 'fastify-type-provider-zod';
import { API_VERSION } from '../../config/version.js';

/** OpenAPI docs generated from the routes' Zod schemas, served at /docs. */
export default fp(async function (fastify: FastifyInstance) {
    await fastify.register(swagger, {
        openapi: {
            info: {
                title: 'PoeLens API',
                description: 'Path of Exile economy history, watchlists and companion data',
                version: API_VERSION,
            },
        },
        transform: jsonSchemaTransform,
    });

    await fastify.register(swaggerUI, {
        routePrefix: '/docs',
        uiConfig: { docExpansion: 'list', deepLinking: true },
    });
});
