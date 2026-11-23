import type { SearchQuery, SearchResponse } from '@poelens/shared';
import { sql, type Kysely } from 'kysely';
import type { Database } from '../../db/schema.js';

interface MatchRow {
    id: number;
    name: string;
    base_type: string | null;
    category: string;
    icon: string | null;
    score: number;
}

/** Characters that mean something to LIKE, escaped so a search for "100%" is a search for those characters. */
function escapeLike(text: string): string {
    return text.replace(/[\\%_]/g, (char) => '\\' + char);
}

/**
 * The default word-similarity threshold (0.6) rejects ordinary typos ("divne" scores 0.5 against "Divine Orb"), so a search
 * lowers it for its own transaction.
 */
const WORD_SIMILARITY_THRESHOLD = 0.4;

/**
 * Items of a game whose name or base type match the text: a trigram word match (`<%`, which forgives typos: "divne" finds
 * Divine Orb) or a plain substring. Results are ranked by strict word similarity, which only counts whole words, so "divne"
 * puts Divine Orb ahead of Sanguine Diviner, which merely contains similar trigrams. The match conditions are served by the
 * GIN trigram indexes.
 */
export async function searchItems(db: Kysely<Database>, query: SearchQuery): Promise<SearchResponse> {
    const pattern = `%${escapeLike(query.q)}%`;
    const { rows } = await db.transaction().execute(async (trx) => {
        await sql`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(WORD_SIMILARITY_THRESHOLD)}, true)`.execute(trx);

        return sql<MatchRow>`
        SELECT id, name, base_type, category, icon,
               GREATEST(strict_word_similarity(${query.q}, name), strict_word_similarity(${query.q}, base_type)) AS score
          FROM items
         WHERE game = ${query.game}
           AND (${query.q} <% name OR ${query.q} <% base_type OR name ILIKE ${pattern} OR base_type ILIKE ${pattern})
         ORDER BY score DESC, length(name), name
         LIMIT ${query.limit}`.execute(trx);
    });

    return {
        game: query.game,
        query: query.q,
        results: rows.map((row) => ({
            item: { id: row.id, name: row.name, baseType: row.base_type, category: row.category, icon: row.icon },
            score: Math.round(row.score * 100) / 100,
        })),
    };
}
