import { LeaguesQuerySchema, LeaguesResponseSchema, type LeaguesResponse } from '@poelens/shared';
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import { db } from '../../../db/kysely.js';
import { listLeagues } from '../../../services/prices/index.js';

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Querystring: z.infer<typeof LeaguesQuerySchema>; Reply: LeaguesResponse }>(
        '/leagues',
        {
            schema: {
                tags: ['prices'],
                description: 'The leagues seen for a game, the current challenge league and its hardcore version first',
                querystring: LeaguesQuerySchema,
                response: { 200: LeaguesResponseSchema },
            },
        },
        async (request) => ({ game: request.query.game, leagues: await listLeagues(db, request.query.game) }),
    );
}
