import { TableQuerySchema, TableResponseSchema, type TableQuery, type TableResponse } from '@poelens/shared';
import type { FastifyInstance } from 'fastify';
import { db } from '../../../db/kysely.js';
import { getTable } from '../../../services/prices/index.js';

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Querystring: TableQuery; Reply: TableResponse }>(
        '/table',
        {
            schema: {
                tags: ['prices'],
                description: "One category's latest prices, most valuable first, in the game's default unit and without low-confidence rows unless asked",
                querystring: TableQuerySchema,
                response: { 200: TableResponseSchema },
            },
        },
        async (request) => getTable(db, request.query),
    );
}
