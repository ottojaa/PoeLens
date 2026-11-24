import {
    ApiTokenParamsSchema,
    ApiTokensResponseSchema,
    CreateApiTokenBodySchema,
    CreateApiTokenResponseSchema,
    MAX_API_TOKENS,
    type ApiTokenParams,
    type ApiTokensResponse,
    type CreateApiTokenBody,
    type CreateApiTokenResponse,
} from '@poelens/shared';
import type { FastifyInstance } from 'fastify';
import { db } from '../../../db/kysely.js';
import { createApiToken, listApiTokens, revokeApiToken } from '../../../services/api-tokens/index.js';

export default async function (fastify: FastifyInstance) {
    fastify.get<{ Reply: ApiTokensResponse }>(
        '/',
        {
            schema: {
                tags: ['api-tokens'],
                description: "The signed-in user's API tokens, newest first, with the most they can hold. Secrets are never listed",
                response: { 200: ApiTokensResponseSchema },
            },
        },
        async (request) => ({ tokens: await listApiTokens(db, request.user.id), max: MAX_API_TOKENS }),
    );

    fastify.post<{ Body: CreateApiTokenBody; Reply: CreateApiTokenResponse }>(
        '/',
        {
            schema: {
                tags: ['api-tokens'],
                description:
                    'Makes an API token for MCP clients. The answer holds the secret, the only time it is ever shown. At the limit (10 tokens) it answers 409 API_TOKENS_FULL',
                body: CreateApiTokenBodySchema,
                response: { 201: CreateApiTokenResponseSchema },
            },
        },
        async (request, reply) => {
            const created = await createApiToken(db, { userId: request.user.id, name: request.body.name, sessionIssuedAt: request.user.issuedAt });

            // A secret must not be kept by a browser or a proxy.
            return reply.header('cache-control', 'no-store').status(201).send(created);
        },
    );

    fastify.delete<{ Params: ApiTokenParams }>(
        '/:id',
        {
            schema: {
                tags: ['api-tokens'],
                description: "Revokes one of the signed-in user's tokens: it stops working on its next call. A token that is already gone is not an error",
                params: ApiTokenParamsSchema,
            },
        },
        async (request, reply) => {
            await revokeApiToken(db, request.user.id, request.params.id);

            return reply.status(204).send();
        },
    );
}
