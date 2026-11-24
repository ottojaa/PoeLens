import {
    WatchlistItemParamsSchema,
    WatchlistQuerySchema,
    WatchlistResponseSchema,
    type WatchlistItemParams,
    type WatchlistQuery,
    type WatchlistResponse,
} from '@poelens/shared';
import type { FastifyInstance } from 'fastify';
import { db } from '../../../db/kysely.js';
import { getWatchlist, unwatchItem, watchItem } from '../../../services/watchlist/index.js';

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Querystring: WatchlistQuery; Reply: WatchlistResponse }>(
        '/',
        {
            schema: {
                tags: ['watchlist'],
                description:
                    "The signed-in user's watched items with their latest price, change and sparkline in a league; watched items with no price there are listed as unlisted",
                querystring: WatchlistQuerySchema,
                response: { 200: WatchlistResponseSchema },
            },
        },
        async (request) => getWatchlist(db, request.user.id, request.query),
    );

    fastify.put<{ Params: WatchlistItemParams }>(
        '/:itemId',
        {
            schema: {
                tags: ['watchlist'],
                description:
                    'Watches an item. Watching a watched item changes nothing. A full list (100 items) answers 409 WATCHLIST_FULL, an unknown item 404',
                params: WatchlistItemParamsSchema,
            },
        },
        async (request, reply) => {
            await watchItem(db, request.user.id, request.params.itemId);

            return reply.status(204).send();
        },
    );

    fastify.delete<{ Params: WatchlistItemParams }>(
        '/:itemId',
        {
            schema: {
                tags: ['watchlist'],
                description: 'Stops watching an item. An item that is not watched is already gone',
                params: WatchlistItemParamsSchema,
            },
        },
        async (request, reply) => {
            await unwatchItem(db, request.user.id, request.params.itemId);

            return reply.status(204).send();
        },
    );
}
