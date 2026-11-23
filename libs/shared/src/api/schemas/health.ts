import { z } from 'zod';

export const ServiceStatusSchema = z.enum(['ok', 'down']);

export const HealthResponseSchema = z.object({
    // "degraded": the API answers but a service it depends on does not.
    status: z.enum(['ok', 'degraded']),
    timestamp: z.string().datetime(),
    version: z.string(),
    uptime: z.number(),
    services: z.object({
        database: ServiceStatusSchema,
    }),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
