import { z } from 'zod';
import { GameSchema } from '../../domain/game.js';
import { UnitSchema } from '../../domain/units.js';

/** What a row's liquidity number counts: open listings (unique items) or traded value in divine (exchange currencies). */
export const LiquidityKindSchema = z.enum(['listings', 'volume']);

export const LiquiditySchema = z.object({
    kind: LiquidityKindSchema,
    /** A listing count, or for `volume` the value traded, in divine. */
    value: z.number(),
});

export const LeagueRefSchema = z.object({
    name: z.string(),
    /** The current challenge league, or its hardcore version. */
    current: z.boolean(),
    hardcore: z.boolean(),
});

export const LeagueSchema = LeagueRefSchema.extend({
    game: GameSchema,
    firstSeen: z.string().datetime(),
    /** When a leagues response that listed this league was last parsed. An unchanged response is not parsed again, so this does not move on every poll. */
    lastSeen: z.string().datetime(),
});

export const ItemRefSchema = z.object({
    id: z.number().int(),
    name: z.string(),
    baseType: z.string().nullable(),
    category: z.string(),
    icon: z.string().nullable(),
});

/** Percent change over each window, in the requested unit. Null until the history reaches back that far. */
export const PriceChangeSchema = z.object({
    h1: z.number().nullable(),
    h24: z.number().nullable(),
    d7: z.number().nullable(),
});

export const PriceRowSchema = z.object({
    item: ItemRefSchema,
    price: z.number(),
    /** When the snapshot this price comes from was fetched. */
    asOf: z.string().datetime(),
    liquidity: LiquiditySchema.nullable(),
    lowConfidence: z.boolean(),
    change: PriceChangeSchema,
});

/** What every price answer resolved: the game, the league `'current'` pointed at, and the unit prices are in. */
export const priceEnvelope = {
    game: GameSchema,
    league: LeagueRefSchema,
    unit: UnitSchema,
};

// Query parameters

const leagueQuery = z.string().min(1).default('current');
const booleanQuery = z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true');

export const MOVER_WINDOWS = ['1h', '24h', '7d'] as const;
export const MoverWindowSchema = z.enum(MOVER_WINDOWS);

export const HISTORY_BUCKETS = ['hour', 'day'] as const;
export const HistoryBucketSchema = z.enum(HISTORY_BUCKETS);

/** The most points one history request may ask for. */
export const MAX_HISTORY_POINTS = 1000;
/** The most items one `latest` request may ask for. */
export const MAX_LATEST_ITEMS = 100;

const commaSeparatedIds = z
    .string()
    .regex(/^\d+(,\d+)*$/, 'Expected comma-separated item ids')
    .transform((value) => [...new Set(value.split(',').map(Number))])
    .pipe(z.array(z.number().int().positive()).min(1).max(MAX_LATEST_ITEMS));

export const TableQuerySchema = z.object({
    game: GameSchema,
    league: leagueQuery,
    category: z.string().min(1),
    unit: UnitSchema.optional(),
    includeLowConfidence: booleanQuery,
    /** Add each row's last week of daily prices (`TableRow.sparkline`). */
    sparkline: booleanQuery,
});

export const LatestQuerySchema = z.object({
    game: GameSchema,
    league: leagueQuery,
    items: commaSeparatedIds,
    unit: UnitSchema.optional(),
    includeLowConfidence: booleanQuery,
});

export const HistoryQuerySchema = z.object({
    game: GameSchema,
    league: leagueQuery,
    item: z.coerce.number().int().positive(),
    unit: UnitSchema.optional(),
    bucket: HistoryBucketSchema.default('hour'),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    includeLowConfidence: booleanQuery,
});

export const MoversQuerySchema = z.object({
    game: GameSchema,
    league: leagueQuery,
    category: z.string().min(1).optional(),
    window: MoverWindowSchema.default('24h'),
    unit: UnitSchema.optional(),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    includeLowConfidence: booleanQuery,
});

export const SearchQuerySchema = z.object({
    game: GameSchema,
    q: z.string().trim().min(2).max(100),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const LeaguesQuerySchema = z.object({ game: GameSchema });

// Responses

export const TableRowSchema = PriceRowSchema.extend({
    /**
     * Present when asked for (`sparkline=true`): the last 7 UTC days' closing prices in the answer's unit, oldest first,
     * one point per day that had a confident price, so it can hold fewer than two.
     */
    sparkline: z.array(z.number()).optional(),
});

export const TableResponseSchema = z.object({
    ...priceEnvelope,
    category: z.string(),
    rows: z.array(TableRowSchema),
});

export const LatestResponseSchema = z.object({
    ...priceEnvelope,
    rows: z.array(PriceRowSchema),
    /** Requested items missing from the newest snapshot of their category (or unknown, or low confidence). */
    unlisted: z.array(z.number().int()),
});

export const HistoryPointSchema = z.object({
    time: z.string().datetime(),
    /** The last price in the bucket. */
    price: z.number(),
    low: z.number(),
    high: z.number(),
});

export const HistoryResponseSchema = z.object({
    ...priceEnvelope,
    item: ItemRefSchema,
    bucket: HistoryBucketSchema,
    from: z.string().datetime(),
    to: z.string().datetime(),
    points: z.array(HistoryPointSchema),
});

export const MoversResponseSchema = z.object({
    ...priceEnvelope,
    window: MoverWindowSchema,
    risers: z.array(PriceRowSchema),
    fallers: z.array(PriceRowSchema),
});

export const SearchResultSchema = z.object({
    item: ItemRefSchema,
    /** 0 to 1, higher is a better match. */
    score: z.number(),
});

export const SearchResponseSchema = z.object({
    game: GameSchema,
    query: z.string(),
    results: z.array(SearchResultSchema),
});

export const LeaguesResponseSchema = z.object({
    game: GameSchema,
    leagues: z.array(LeagueSchema),
});

export type Liquidity = z.infer<typeof LiquiditySchema>;
export type LeagueRef = z.infer<typeof LeagueRefSchema>;
export type League = z.infer<typeof LeagueSchema>;
export type ItemRef = z.infer<typeof ItemRefSchema>;
export type PriceChange = z.infer<typeof PriceChangeSchema>;
export type PriceRow = z.infer<typeof PriceRowSchema>;
export type TableRow = z.infer<typeof TableRowSchema>;
export type MoverWindow = z.infer<typeof MoverWindowSchema>;
export type HistoryBucket = z.infer<typeof HistoryBucketSchema>;
export type TableQuery = z.infer<typeof TableQuerySchema>;
export type LatestQuery = z.infer<typeof LatestQuerySchema>;
export type HistoryQuery = z.infer<typeof HistoryQuerySchema>;
export type MoversQuery = z.infer<typeof MoversQuerySchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type TableResponse = z.infer<typeof TableResponseSchema>;
export type LatestResponse = z.infer<typeof LatestResponseSchema>;
export type HistoryResponse = z.infer<typeof HistoryResponseSchema>;
export type MoversResponse = z.infer<typeof MoversResponseSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
export type LeaguesResponse = z.infer<typeof LeaguesResponseSchema>;
