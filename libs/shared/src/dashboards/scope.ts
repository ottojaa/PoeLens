import { z } from 'zod';
import { CATEGORIES, type CategoryGroup } from '../domain/categories.js';
import type { Game } from '../domain/game.js';

export const SCOPE_GROUPS = ['all', 'economy', 'uniques'] as const;

/** The most categories a scope can list: more than any game has. */
const MAX_SCOPE_CATEGORIES = 40;

/** Which categories a movers or screener block looks over: a whole group, or a list of categories. */
export const ScopeSchema = z.union([
    z.object({ group: z.enum(SCOPE_GROUPS) }),
    z.object({
        categories: z.array(z.string().min(1).max(60)).min(1).max(MAX_SCOPE_CATEGORIES),
    }),
]);

export type Scope = z.infer<typeof ScopeSchema>;

const GROUP_LABELS: Record<(typeof SCOPE_GROUPS)[number], string> = { all: 'all categories', economy: 'economy', uniques: 'all uniques' };

/** What a scope reads as in a block's title, e.g. "all uniques" or "Currency, Fragments". */
export function toScopeLabel(game: Game, scope: Scope): string {
    if ('group' in scope) return GROUP_LABELS[scope.group];

    return scope.categories.map((id) => CATEGORIES[game].find((category) => category.id === id)?.label ?? id).join(', ');
}

/** The category ids a scope covers in a game, in the game's own order. Ids the game does not have are left out. */
export function toScopeCategories(game: Game, scope: Scope): string[] {
    const categories = CATEGORIES[game];

    if ('categories' in scope) return categories.filter((category) => scope.categories.includes(category.id)).map((category) => category.id);

    const group: CategoryGroup | undefined = scope.group === 'all' ? undefined : scope.group;

    return categories.filter((category) => group === undefined || category.group === group).map((category) => category.id);
}

/** The ids in a scope's list that the game has no category for; none for a group. */
export function findUnknownCategories(game: Game, scope: Scope): string[] {
    if ('group' in scope) return [];

    const known = new Set(CATEGORIES[game].map((category) => category.id));

    return scope.categories.filter((id) => !known.has(id));
}
