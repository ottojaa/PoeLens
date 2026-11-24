import { HistoryQuerySchema, HistoryResponseSchema, type HistoryQuery, type HistoryResponse } from '@poelens/shared';
import type { FastifyInstance } from 'fastify';
import { db } from '../../../db/kysely.js';
import { getHistory } from '../../../services/prices/index.js';

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Querystring: HistoryQuery; Reply: HistoryResponse }>(
        '/history',
        {
            schema: {
                tags: ['prices'],
                description:
                    "One item's price over time, bucketed by hour or day (last price, low and high of each bucket). unit=auto picks one unit for the whole chart from the item's newest price, and the answer names it",
                querystring: HistoryQuerySchema,
                response: { 200: HistoryResponseSchema },
            },
        },
        async (request) => getHistory(db, request.query),
    );
}
