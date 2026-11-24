import { createFileRoute } from '@tanstack/react-router';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { parseEconomySearch } from '@/lib/economy/search-params';

/** Home: the user's dashboards. */
export const Route = createFileRoute('/')({
    validateSearch: parseEconomySearch,
    component: DashboardPage,
});
