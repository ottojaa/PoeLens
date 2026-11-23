import type { Game } from '@poelens/shared';

/** One HTTP request a data source needs made. `league` and `category` are empty strings when the request has none. */
export interface RequestSpec {
    /** The source's own name for the kind of request, e.g. `leagues`, `exchange`, `stash`. */
    kind: string;
    league: string;
    category: string;
    url: string;
}

/** What identifies a request in the archive, and all a parser needs to know about where a body came from. */
export type RequestKey = Pick<RequestSpec, 'kind' | 'league' | 'category'>;

export interface LeagueFact {
    name: string;
    hardcore: boolean;
    /** The current challenge league, or its hardcore version. */
    current: boolean;
}

export interface ItemFact {
    /** Stable within the source, unique within one response. */
    key: string;
    name: string;
    baseType: string | null;
    category: string;
    icon: string | null;
}

export interface PriceFact {
    divine: number;
    exalted: number;
    chaos: number;
    listings: number | null;
    /** Value traded, in divine. */
    volume: number | null;
    lowConfidence: boolean;
}

export interface EntryFact {
    item: ItemFact;
    price: PriceFact;
}

/** Everything one archived response says, in the source-neutral shape the runtime writes. */
export interface ParsedFacts {
    leagues: LeagueFact[];
    entries: EntryFact[];
}

/** A response that does not have the shape the parser expects. Its message is short, static text plus a detail. */
export class ParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ParseError';
    }
}

export interface LeagueRecord {
    name: string;
    hardcore: boolean;
    current: boolean;
}

/**
 * A data source. It says what to fetch and how to read an archived response, nothing else: HTTP, archiving, writing and
 * bookkeeping belong to the runtime, so an adapter cannot be impolite and a re-parse runs exactly the live code.
 */
export interface SourceAdapter {
    source: string;
    game: Game;
    /** Bumped when `parse` changes what it produces, so rows can tell which parser wrote them. */
    parserVersion: number;
    /** The request that lists the leagues. */
    discover(): RequestSpec;
    /** The requests of one cycle, given the leagues the store knows. */
    plan(leagues: LeagueRecord[]): RequestSpec[];
    /** Pure: the same body always gives the same facts. Throws `ParseError` when the body is not the expected shape. */
    parse(key: RequestKey, body: string): ParsedFacts;
}
