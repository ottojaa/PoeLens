import { gunzipBody, type CollectorStore, type RawFilter } from './store.js';
import { ParseError, type SourceAdapter } from './types.js';

export interface ReparseResult {
    /** Responses parsed and written again. */
    parsed: number;
    /** Responses the parser rejected; their archive row records why. */
    parseErrors: number;
    priceRows: number;
}

/**
 * Parses archived responses again with the live parser and writes their rows. Because prices are keyed by the
 * response's own fetch time, this is an idempotent upsert: unchanged parser output reproduces the same rows, and a fixed
 * parser corrects the rows a broken one wrote.
 */
export async function reparseRaw(adapter: SourceAdapter, store: CollectorStore, filter: Omit<RawFilter, 'source' | 'game'>): Promise<ReparseResult> {
    const ids = await store.listRawIds({ ...filter, source: adapter.source, game: adapter.game });
    const result: ReparseResult = { parsed: 0, parseErrors: 0, priceRows: 0 };

    for (const id of ids) {
        const raw = await store.loadRaw(id);

        try {
            const facts = adapter.parse(raw, gunzipBody(raw.body));

            result.priceRows += await store.applyFacts(raw, facts, adapter.parserVersion);
            result.parsed += 1;
        } catch (error) {
            if (!(error instanceof ParseError)) throw error;

            result.parseErrors += 1;
            await store.markParseError(id, error.message);
        }
    }

    return result;
}
