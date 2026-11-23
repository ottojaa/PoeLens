import { z } from 'zod';

// Matches docker-compose.yml. Only used outside production, so a checkout with no .env still boots (and /health says "degraded").
const DEV_DATABASE_URL = 'postgres://poelens:poelens@localhost:5433/poelens';

const DEFAULT_COLLECTOR_CONTACT = 'https://github.com/ottojaa/PoeLens';

const envSchema = z
    .object({
        // Server
        PORT: z.coerce.number().default(3100),
        HOST: z.string().default('0.0.0.0'),
        NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

        // Database (Postgres + TimescaleDB). Required in production: a missing value must fail the boot, not point at localhost.
        DATABASE_URL: z.string().url().optional(),

        // CORS (HTTP API): comma-separated origins
        CORS_ORIGIN: z.string().default('http://localhost:4300'),

        // Price collector. Off unless switched on (production only), so boots, `nx serve` and tests never poll poe.ninja.
        COLLECTOR_ENABLED: z
            .enum(['true', 'false'])
            .default('false')
            .transform((value) => value === 'true'),
        // Goes into the User-Agent so a data source can reach whoever is polling.
        COLLECTOR_CONTACT: z.string().min(1).default(DEFAULT_COLLECTOR_CONTACT),
        // Comma-separated league names; empty means the current challenge league and its hardcore version.
        COLLECTOR_LEAGUES: z
            .string()
            .default('')
            .transform((value) =>
                value
                    .split(',')
                    .map((name) => name.trim())
                    .filter(Boolean),
            ),
    })
    .superRefine((value, ctx) => {
        if (value.NODE_ENV === 'production' && !value.DATABASE_URL) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['DATABASE_URL'], message: 'Required in production' });
        }
    })
    .transform((value) => ({ ...value, DATABASE_URL: value.DATABASE_URL ?? DEV_DATABASE_URL }));

export type Env = z.infer<typeof envSchema>;

/** Validates an environment (process.env in the app). Throws a ZodError listing every problem. */
export function parseEnv(source: Record<string, string | undefined>): Env {
    return envSchema.parse(source);
}
