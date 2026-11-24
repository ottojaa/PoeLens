import { createFileRoute } from '@tanstack/react-router';
import { WatchlistPage } from '@/components/watchlist/WatchlistPage';
import { parseEconomySearch, toEconomyView } from '@/lib/economy/search-params';

export const Route = createFileRoute('/watchlist')({
    validateSearch: parseEconomySearch,
    component: WatchlistRoute,
});

function WatchlistRoute() {
    return <WatchlistPage view={toEconomyView(Route.useSearch())} />;
}
