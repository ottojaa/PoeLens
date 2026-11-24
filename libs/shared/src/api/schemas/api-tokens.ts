import { z } from 'zod';

/** The most API tokens one user can hold at a time. */
export const MAX_API_TOKENS = 10;

/** What every API token secret starts with, so a leaked one can be recognised and a session token is never mistaken for it. */
export const API_TOKEN_PREFIX = 'pl_';

/** How many characters of a secret the list shows (`pl_` and seven more). */
export const API_TOKEN_PREFIX_LENGTH = 10;

export const ApiTokenSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    /** The first characters of the secret: enough to tell tokens apart, not enough to use one. */
    prefix: z.string(),
    createdAt: z.string().datetime(),
    /** Null until the token is first used. Written at most once a minute. */
    lastUsedAt: z.string().datetime().nullable(),
});

export const CreateApiTokenBodySchema = z.object({
    name: z.string().trim().min(1).max(60),
});

export const CreateApiTokenResponseSchema = z.object({
    token: ApiTokenSchema,
    /** The whole secret. Returned by this answer only: the server keeps a hash. */
    secret: z.string(),
});

export const ApiTokensResponseSchema = z.object({
    tokens: z.array(ApiTokenSchema),
    max: z.number().int(),
});

export const ApiTokenParamsSchema = z.object({
    id: z.string().uuid(),
});

export type ApiToken = z.infer<typeof ApiTokenSchema>;
export type CreateApiTokenBody = z.infer<typeof CreateApiTokenBodySchema>;
export type CreateApiTokenResponse = z.infer<typeof CreateApiTokenResponseSchema>;
export type ApiTokensResponse = z.infer<typeof ApiTokensResponseSchema>;
export type ApiTokenParams = z.infer<typeof ApiTokenParamsSchema>;
