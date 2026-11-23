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

export type UserRole = 'admin' | 'member';

export interface UsersTable {
    id: Generated<string>;
    /** Stored lower-cased; a unique index on lower(email) keeps it that way. */
    email: string;
    display_name: string;
    password_hash: string;
    role: UserRole;
    is_active: Generated<boolean>;
    created_at: Generated<Date>;
    updated_at: Generated<Date>;
    last_login_at: Date | null;
}

export interface UserIdentitiesTable {
    provider: string;
    subject: string;
    user_id: string;
    created_at: Generated<Date>;
}

export interface RefreshTokensTable {
    id: Generated<string>;
    user_id: string;
    token_hash: string;
    expires_at: Date;
    created_at: Generated<Date>;
}

export interface InvitesTable {
    id: Generated<string>;
    token_hash: string;
    role: UserRole;
    created_by: string | null;
    created_at: Generated<Date>;
    expires_at: Date;
    used_at: Date | null;
    used_by: string | null;
    revoked_at: Date | null;
}

export interface PasswordResetsTable {
    id: Generated<string>;
    token_hash: string;
    user_id: string;
    created_by: string | null;
    created_at: Generated<Date>;
    expires_at: Date;
    used_at: Date | null;
}

export interface Database {
    leagues: LeaguesTable;
    items: ItemsTable;
    item_keys: ItemKeysTable;
    raw_responses: RawResponsesTable;
    prices: PricesTable;
    collector_runs: CollectorRunsTable;
    users: UsersTable;
    user_identities: UserIdentitiesTable;
    refresh_tokens: RefreshTokensTable;
    invites: InvitesTable;
    password_resets: PasswordResetsTable;
}
