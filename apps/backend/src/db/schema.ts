import type { ColumnType, Generated } from 'kysely';

/**
 * Kysely table types. Each interface matches its PostgreSQL table exactly; add one per table as migrations create them.
 * Tables are added here together with the migration that creates them.
 */

export interface LeaguesTable {
    game: string;
    name: string;
    hardcore: boolean;
    current: Generated<boolean>;
    first_seen: Date;
    last_seen: Date;
}

export interface ItemsTable {
    id: Generated<number>;
    game: string;
    name: string;
    base_type: string | null;
    category: string;
    icon: string | null;
}

export interface ItemKeysTable {
    source: string;
    game: string;
    external_key: string;
    item_id: number;
}

export interface RawResponsesTable {
    id: Generated<number>;
    source: string;
    game: string;
    kind: string;
    league: Generated<string>;
    category: Generated<string>;
    url: string;
    fetched_at: Date;
    status: number;
    etag: string | null;
    sha256: string;
    /** Gzipped response body. */
    body: Buffer;
    /** Null until the response has been parsed and its rows written. */
    parser_version: number | null;
    parse_error: string | null;
}

export interface PricesTable {
    time: Date;
    game: string;
    league: string;
    item_id: number;
    source: string;
    divine: number;
    exalted: number;
    chaos: number;
    listings: number | null;
    /** Value traded, in divine. */
    volume: number | null;
    low_confidence: Generated<boolean>;
    raw_id: number;
}

export type CollectorRunStatus = 'running' | 'success' | 'partial' | 'failed' | 'abandoned';

export interface CollectorRunsTable {
    id: Generated<number>;
    source: string;
    game: string;
    started_at: Date;
    finished_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
    status: CollectorRunStatus;
    error: string | null;
    requests: Generated<number>;
    unchanged: Generated<number>;
    stored: Generated<number>;
    price_rows: Generated<number>;
    parse_errors: Generated<number>;
    fetch_errors: Generated<number>;
}

export interface Database {
    leagues: LeaguesTable;
    items: ItemsTable;
    item_keys: ItemKeysTable;
    raw_responses: RawResponsesTable;
    prices: PricesTable;
    collector_runs: CollectorRunsTable;
}
