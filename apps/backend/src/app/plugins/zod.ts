import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

/**
 * Routes declare their body/query/response schemas as Zod schemas from `@poelens/shared`; these compilers make Fastify
 * validate requests and serialize responses with them. Kept apart from the Swagger plugin so docs can change without
 * touching validation.
 */
export default fp(async function (fastify: FastifyInstance) {
    fastify.setValidatorCompiler(validatorCompiler);
    fastify.setSerializerCompiler(serializerCompiler);
});
