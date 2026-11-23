import { MoversQuerySchema, MoversResponseSchema, type MoversQuery, type MoversResponse } from '@poelens/shared';
import type { FastifyInstance } from 'fastify';
import { db } from '../../../db/kysely.js';
import { getMovers } from '../../../services/prices/index.js';

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Querystring: MoversQuery; Reply: MoversResponse }>(
        '/movers',
        {
            schema: {
                tags: ['prices'],
                description: 'The biggest risers and fallers over 1h, 24h or 7d, in one category or all of them',
                querystring: MoversQuerySchema,
                response: { 200: MoversResponseSchema },
            },
        },
        async (request) => getMovers(db, request.query),
    );
}
