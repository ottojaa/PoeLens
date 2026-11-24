import { ApiTokensResponseSchema, CreateApiTokenResponseSchema, type CreateApiTokenResponse } from '@poelens/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL, fetchApi, sendApi } from './client';

const TOKENS_KEY = ['api-tokens'] as const;

/** The signed-in user's tokens (never a secret) and how many they may hold. */
export function useApiTokens() {
    return useQuery({ queryKey: TOKENS_KEY, queryFn: () => fetchApi('/api-tokens', ApiTokensResponseSchema) });
}

/**
 * Creates a token. This is a plain function, not a mutation: the answer holds the one-time secret, and a mutation's
 * result would sit in the query client's mutation cache for minutes. The dialog keeps the answer in its own state.
 */
export function createApiToken(name: string): Promise<CreateApiTokenResponse> {
    return fetchApi('/api-tokens', CreateApiTokenResponseSchema, { method: 'POST', json: { name } });
}

export function useRefreshApiTokens() {
    const queryClient = useQueryClient();

    return () => queryClient.invalidateQueries({ queryKey: TOKENS_KEY });
}

export function useRevokeApiToken() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => sendApi('/api-tokens/' + id, { method: 'DELETE' }),
        onSettled: () => queryClient.invalidateQueries({ queryKey: TOKENS_KEY }),
    });
}

/** The address Claude connects to: the API's own origin (this page's, when the build has no API URL) plus `/mcp`. */
export function toMcpUrl(): string {
    return (API_URL || window.location.origin) + '/mcp';
}
