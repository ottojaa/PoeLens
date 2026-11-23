import { LatestQuerySchema, LatestResponseSchema, type LatestQuery, type LatestResponse } from '@poelens/shared';
import type { FastifyInstance } from 'fastify';
import { db } from '../../../db/kysely.js';
import { getLatest } from '../../../services/prices/index.js';

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Querystring: LatestQuery; Reply: LatestResponse }>(
        '/latest',
        {
            schema: {
                tags: ['prices'],
                description: 'The latest price of specific items; items missing from their category\'s newest snapshot are listed as "unlisted"',
                querystring: LatestQuerySchema,
                response: { 200: LatestResponseSchema },
            },
        },
        async (request) => getLatest(db, request.query),
    );
}
