import { HealthResponseSchema } from '@poelens/shared';
import { useQuery } from '@tanstack/react-query';
import { fetchApi } from './client';

const HEALTH_POLL_MS = 30_000;

export function useHealth() {
    return useQuery({
        queryKey: ['health'],
        queryFn: () => fetchApi('/health', HealthResponseSchema),
        refetchInterval: HEALTH_POLL_MS,
        retry: false,
    });
}
