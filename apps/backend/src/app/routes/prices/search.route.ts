import { SearchQuerySchema, SearchResponseSchema, type SearchQuery, type SearchResponse } from '@poelens/shared';
import type { FastifyInstance } from 'fastify';
import { db } from '../../../db/kysely.js';
import { searchItems } from '../../../services/prices/index.js';

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Querystring: SearchQuery; Reply: SearchResponse }>(
        '/search',
        {
            schema: {
                tags: ['prices'],
                description: 'Items of a game by name or base type, forgiving typos, best match first',
                querystring: SearchQuerySchema,
                response: { 200: SearchResponseSchema },
            },
        },
        async (request) => searchItems(db, request.query),
    );
}
