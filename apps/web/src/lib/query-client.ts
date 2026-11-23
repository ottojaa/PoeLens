import { QueryClient } from '@tanstack/react-query';

// Economy data changes about hourly (PoE 2) or every 15 minutes (PoE 1); refetching more often than this buys nothing.
const ECONOMY_STALE_MS = 5 * 60 * 1000;

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: ECONOMY_STALE_MS,
            retry: 1,
        },
    },
});
