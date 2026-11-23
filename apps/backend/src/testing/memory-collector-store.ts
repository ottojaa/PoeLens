import type { Game } from '@poelens/shared';
import type { CollectorStore, LatestRaw, NewRaw, RawFilter, RawRecord, RunSummary } from '../collector/store.js';
import type { LeagueRecord, ParsedFacts, RequestKey } from '../collector/types.js';

interface StoredRaw extends NewRaw {
    id: number;
    parserVersion: number | null;
    parseError: string | null;
}

export interface MemoryRun {
    id: number;
    startedAt: Date;
    finishedAt: Date | null;
    summary: RunSummary | null;
}

/** An in-memory `CollectorStore`: lets the runtime's HTTP, archive and bookkeeping behaviour be tested without a database. */
export class MemoryCollectorStore implements CollectorStore {
    leagues: LeagueRecord[] = [];
    raws: StoredRaw[] = [];
    runs: MemoryRun[] = [];
    /** What `applyFacts` was given, in order. */
    applied: Array<{ rawId: number; facts: ParsedFacts }> = [];
    /** Set to make `applyFacts` throw, to prove a response stays archived whatever the write does. */
    failApply: Error | null = null;

    async startRun(_source: string, _game: Game, startedAt: Date): Promise<number> {
        const id = this.runs.length + 1;

        this.runs.push({ id, startedAt, finishedAt: null, summary: null });

        return id;
    }

    async finishRun(id: number, finishedAt: Date, summary: RunSummary): Promise<void> {
        const run = this.runs.find((candidate) => candidate.id === id);

        if (run) Object.assign(run, { finishedAt, summary });
    }

    async findLastRunStart(): Promise<Date | null> {
        return this.runs.at(-1)?.startedAt ?? null;
    }

    async abandonStaleRuns(): Promise<number> {
        return 0;
    }

    async loadLeagues(): Promise<LeagueRecord[]> {
        return this.leagues;
    }

    async findLatestRaw(source: string, game: Game, key: RequestKey): Promise<LatestRaw | null> {
        const matches = this.raws.filter(
            (raw) => raw.source === source && raw.game === game && raw.kind === key.kind && raw.league === key.league && raw.category === key.category,
        );
        const latest = matches.at(-1);

        return latest ? { id: latest.id, etag: latest.etag, sha256: latest.sha256 } : null;
    }

    async insertRaw(raw: NewRaw): Promise<number> {
        const id = this.raws.length + 1;

        this.raws.push({ ...raw, id, parserVersion: null, parseError: null });

        return id;
    }

    async updateEtag(id: number, etag: string | null): Promise<void> {
        const raw = this.raws.find((candidate) => candidate.id === id);

        if (raw) raw.etag = etag;
    }

    async markParseError(id: number, message: string): Promise<void> {
        const raw = this.raws.find((candidate) => candidate.id === id);

        if (raw) raw.parseError = message;
    }

    async applyFacts(raw: RawRecord, facts: ParsedFacts, parserVersion: number): Promise<number> {
        if (this.failApply) throw this.failApply;

        this.applied.push({ rawId: raw.id, facts });

        const stored = this.raws.find((candidate) => candidate.id === raw.id);

        if (stored) Object.assign(stored, { parserVersion, parseError: null });

        // Mirrors the database store: a league list becomes the known leagues.
        if (facts.leagues.length) this.leagues = facts.leagues;

        return facts.entries.length;
    }

    async listRawIds(filter: RawFilter): Promise<number[]> {
        return this.raws
            .filter((raw) => raw.source === filter.source && raw.game === filter.game && (filter.kind === undefined || raw.kind === filter.kind))
            .map((raw) => raw.id);
    }

    async loadRaw(id: number): Promise<RawRecord> {
        const raw = this.raws.find((candidate) => candidate.id === id);

        if (!raw) throw new Error('No such raw response: ' + id);

        return { id, source: raw.source, game: raw.game, kind: raw.kind, league: raw.league, category: raw.category, fetchedAt: raw.fetchedAt, body: raw.body };
    }
}
