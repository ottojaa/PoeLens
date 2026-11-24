import type { Game, ItemRef } from '@poelens/shared';
import type { Kysely } from 'kysely';
import type { Database } from '../db/schema.js';
import { searchItems } from '../services/prices/index.js';

/** The most candidates an answer lists. */
const MAX_CANDIDATES = 5;
/** A read accepts the top search hit without asking when it scores at least this much and clearly beats the next. */
const CLEAR_SCORE = 0.9;
const MIN_SEARCH_LENGTH = 2;

export type Resolution = { kind: 'found'; item: ItemRef } | { kind: 'unresolved'; why: 'unknown' | 'ambiguous' | 'inexact'; candidates: ItemRef[] };

function toItemRef(row: { id: number; name: string; base_type: string | null; category: string; icon: string | null }): ItemRef {
    return { id: row.id, name: row.name, baseType: row.base_type, category: row.category, icon: row.icon };
}

async function loadItemById(db: Kysely<Database>, game: Game, id: number): Promise<ItemRef | null> {
    const row = await db
        .selectFrom('items')
        .select(['id', 'name', 'base_type', 'category', 'icon'])
        .where('game', '=', game)
        .where('id', '=', id)
        .executeTakeFirst();

    return row ? toItemRef(row) : null;
}

/** Items whose name is the text, ignoring case. `items` has no unique (game, name), so there can be several. */
async function loadItemsByExactName(db: Kysely<Database>, game: Game, name: string): Promise<ItemRef[]> {
    const rows = await db
        .selectFrom('items')
        .select(['id', 'name', 'base_type', 'category', 'icon'])
        .where('game', '=', game)
        .where((eb) => eb(eb.fn('lower', ['name']), '=', name.toLowerCase()))
        .orderBy('category')
        .orderBy('id')
        .limit(MAX_CANDIDATES + 1)
        .execute();

    return rows.map(toItemRef);
}

async function loadSimilarItems(db: Kysely<Database>, game: Game, text: string) {
    if (text.length < MIN_SEARCH_LENGTH) return [];

    return (await searchItems(db, { game, q: text, limit: MAX_CANDIDATES + 1 })).results;
}

/**
 * Turns what a model wrote ("Divine Orb", "divine orb", "123") into one item, or says why it cannot.
 *
 * An all-digits text is an item id. Otherwise an exact name (any case) wins when exactly one item has it; several
 * items with the name are ambiguous. With no exact name, a read (`guess`) takes the top search hit only when it is clearly
 * ahead, and a write never guesses: it gets the candidates and writes nothing.
 */
export async function resolveItem(db: Kysely<Database>, input: { game: Game; text: string; guess: boolean }): Promise<Resolution> {
    const text = input.text.trim();

    if (/^\d+$/.test(text)) {
        const byId = Number.isSafeInteger(Number(text)) ? await loadItemById(db, input.game, Number(text)) : null;

        return byId ? { kind: 'found', item: byId } : { kind: 'unresolved', why: 'unknown', candidates: [] };
    }

    const exact = await loadItemsByExactName(db, input.game, text);

    if (exact.length === 1 && exact[0]) return { kind: 'found', item: exact[0] };

    if (exact.length > 1) return { kind: 'unresolved', why: 'ambiguous', candidates: exact.slice(0, MAX_CANDIDATES) };

    const similar = await loadSimilarItems(db, input.game, text);
    const [top, next] = similar;

    if (input.guess && top && top.score >= CLEAR_SCORE && (!next || top.score > next.score)) return { kind: 'found', item: top.item };

    return { kind: 'unresolved', why: input.guess ? 'unknown' : 'inexact', candidates: similar.slice(0, MAX_CANDIDATES).map((hit) => hit.item) };
}
