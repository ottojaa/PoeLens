import { CATEGORIES, type Game } from '@poelens/shared';

/** A category's display name ("Uncut gems"), falling back to the raw id for one the game does not list. */
export function toCategoryLabel(game: Game, categoryId: string): string {
    return CATEGORIES[game].find((category) => category.id === categoryId)?.label ?? categoryId;
}
