import { createFileRoute } from '@tanstack/react-router';
import { EconomyPage } from '@/components/economy/EconomyPage';
import { parseEconomySearch, toEconomyView } from '@/lib/economy/search-params';

export const Route = createFileRoute('/economy/$category')({
    validateSearch: parseEconomySearch,
    component: EconomyRoute,
});

function EconomyRoute() {
    const { category } = Route.useParams();
    const search = Route.useSearch();

    return <EconomyPage categoryId={category} view={toEconomyView(search)} />;
}
