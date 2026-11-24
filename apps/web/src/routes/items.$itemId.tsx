import { createFileRoute } from '@tanstack/react-router';
import { ItemPage } from '@/components/economy/ItemPage';
import { parseItemSearch, toRange } from '@/lib/economy/search-params';
import { ErrorState } from '@/components/economy/states';

export const Route = createFileRoute('/items/$itemId')({
    validateSearch: parseItemSearch,
    component: ItemRoute,
});

function ItemRoute() {
    const { itemId } = Route.useParams();
    const search = Route.useSearch();
    const id = Number(itemId);

    if (!Number.isInteger(id) || id <= 0)
        return <ErrorState title="This item does not exist" message="Check the link, or find the item with the search (Ctrl+K or ⌘K)." />;

    return <ItemPage itemId={id} range={toRange(search)} />;
}
