import { gunzipSync, gzipSync } from 'node:zlib';
import type { Game } from '@poelens/shared';
import type { CollectorRunStatus } from '../db/schema.js';
import type { LeagueRecord, ParsedFacts, RequestKey } from './types.js';

export interface RawRecord extends RequestKey {
    id: number;
    source: string;
    game: Game;
    fetchedAt: Date;
    /** Gzipped. */
    body: Buffer;
}

export interface LatestRaw {
    id: number;
    etag: string | null;
    sha256: string;
}

export interface NewRaw extends RequestKey {
    source: string;
    game: Game;
    url: string;
    fetchedAt: Date;
    status: number;
    etag: string | null;
    sha256: string;
    body: Buffer;
}

export interface RunSummary {
    status: CollectorRunStatus;
    error: string | null;
    requests: number;
    unchanged: number;
    stored: number;
    priceRows: number;
    parseErrors: number;
    fetchErrors: number;
}

export interface RawFilter {
    source: string;
    game: Game;
    kind?: string;
    category?: string;
    league?: string;
    from?: Date;
    to?: Date;
}

/**
 * Everything the runtime needs from storage, narrow enough to fake in memory: the HTTP, archive-before-parse and
 * bookkeeping behaviour is tested without a database.
 */
export interface CollectorStore {
    startRun(source: string, game: Game, startedAt: Date): Promise<number>;
    finishRun(id: number, finishedAt: Date, summary: RunSummary): Promise<void>;
    /** When the newest cycle began, so the next one can be spaced from it across restarts. */
    findLastRunStart(source: string, game: Game): Promise<Date | null>;
    /** Marks cycles a crashed process left `running` as `abandoned`. Only call while holding the collector lock. */
    abandonStaleRuns(finishedAt: Date): Promise<number>;

    loadLeagues(game: Game): Promise<LeagueRecord[]>;

    /** The newest archived response for this request, whose ETag and hash decide whether a new body is news. */
    findLatestRaw(source: string, game: Game, key: RequestKey): Promise<LatestRaw | null>;
    insertRaw(raw: NewRaw): Promise<number>;
    updateEtag(id: number, etag: string | null): Promise<void>;
    markParseError(id: number, message: string): Promise<void>;

    /** Writes what a response says (leagues, items, prices) and marks it parsed, in one transaction. Returns the price rows written. */
    applyFacts(raw: RawRecord, facts: ParsedFacts, parserVersion: number): Promise<number>;

    /** Ids of archived responses in fetch order, for a re-parse. */
    listRawIds(filter: RawFilter): Promise<number[]>;
    loadRaw(id: number): Promise<RawRecord>;
}

export function gzipBody(body: Buffer): Buffer {
    return gzipSync(body);
}

export function gunzipBody(body: Buffer): string {
    return gunzipSync(body).toString('utf8');
}
