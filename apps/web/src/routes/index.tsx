import { CATEGORIES } from '@poelens/shared';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { GAME } from '@/lib/economy/use-economy-context';

/** There is no home page of its own: the economy view is the app, starting at the first category. */
export const Route = createFileRoute('/')({
    beforeLoad: () => {
        const first = CATEGORIES[GAME][0];

        if (!first) throw new Error('No categories for the game: ' + GAME);

        throw redirect({ to: '/economy/$category', params: { category: first.id }, search: true, replace: true });
    },
});
