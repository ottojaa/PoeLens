import { z } from 'zod';

export const ServiceStatusSchema = z.enum(['ok', 'down']);

/** `disabled`: the collector is switched off, and the overall status ignores it. `degraded`: stale, or the last cycle had errors. */
export const CollectorStatusSchema = z.enum(['disabled', 'ok', 'degraded']);

export const CollectorRunSummarySchema = z.object({
    status: z.enum(['running', 'success', 'partial', 'failed', 'abandoned']),
    startedAt: z.string().datetime(),
    finishedAt: z.string().datetime().nullable(),
    requests: z.number().int(),
    parseErrors: z.number().int(),
    fetchErrors: z.number().int(),
    /** A short message, never a stack trace. */
    error: z.string().nullable(),
});

export const CollectorHealthSchema = z.object({
    status: CollectorStatusSchema,
    /** The newest cycle that finished, whatever its outcome. */
    lastRun: CollectorRunSummarySchema.nullable(),
    /** When the newest cycle that did not fail finished. */
    lastSuccessAt: z.string().datetime().nullable(),
});

export const HealthResponseSchema = z.object({
    // "degraded": the API answers but a service it depends on does not.
    status: z.enum(['ok', 'degraded']),
    timestamp: z.string().datetime(),
    version: z.string(),
    uptime: z.number(),
    services: z.object({
        database: ServiceStatusSchema,
        collector: CollectorHealthSchema,
    }),
});

export type CollectorHealth = z.infer<typeof CollectorHealthSchema>;
export type CollectorRunSummary = z.infer<typeof CollectorRunSummarySchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
