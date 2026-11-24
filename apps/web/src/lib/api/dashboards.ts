import {
    DASHBOARD_CHANGED_CODE,
    DashboardDataResponseSchema,
    DashboardSchema,
    DashboardsResponseSchema,
    toDataPanels,
    type CreateDashboardBody,
    type Dashboard,
    type DashboardDataBody,
    type DashboardsResponse,
    type Game,
    type Panel,
    type SaveDashboardBody,
} from '@poelens/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi, sendApi, ApiError } from './client';
import { REFRESH_INTERVAL_MS, type PriceScope } from './prices';

const dashboardsKey = (game: Game) => ['dashboards', game] as const;

/** The signed-in user's dashboards of a game, in tab order. A user with none gets the starter, at revision 0. */
export function useDashboards(game: Game) {
    return useQuery({
        queryKey: dashboardsKey(game),
        queryFn: () => fetchApi('/dashboards?game=' + game, DashboardsResponseSchema),
    });
}

/** The request for the prices behind some panels: what the query key and the POST body are both made of. */
export function toDataBody(scope: PriceScope, panels: readonly Pick<Panel, 'id' | 'unit' | 'blocks'>[]): DashboardDataBody {
    return { game: scope.game, league: scope.league, unit: scope.unit, panels: toDataPanels(panels) };
}

/**
 * The query key of the data request: the request itself. Layout, notes, names and the order of panels and blocks are
 * not part of it, so they never refetch; a panel's unit, the header's unit or the league are.
 */
export function toDataKey(body: DashboardDataBody) {
    return ['dashboard-data', body] as const;
}

/** The prices behind a set of panels. Keeps the old numbers on screen while a changed block or unit loads. */
export function useDashboardData(scope: PriceScope, panels: readonly Pick<Panel, 'id' | 'unit' | 'blocks'>[]) {
    const body = toDataBody(scope, panels);

    return useQuery({
        queryKey: toDataKey(body),
        queryFn: () => fetchApi('/dashboards/data', DashboardDataResponseSchema, { method: 'POST', json: body }),
        enabled: body.panels.length > 0,
        placeholderData: keepPreviousData,
        refetchInterval: REFRESH_INTERVAL_MS,
    });
}

/** Writes a changed or new dashboard into the cached list, keeping tab order. */
function withDashboard(list: DashboardsResponse | undefined, dashboard: Dashboard): DashboardsResponse | undefined {
    if (!list) return list;

    const known = list.dashboards.some((candidate) => candidate.id === dashboard.id);
    const dashboards = known
        ? list.dashboards.map((candidate) => (candidate.id === dashboard.id ? dashboard : candidate))
        : [...list.dashboards, dashboard];

    return { ...list, dashboards };
}

export function useCreateDashboard(game: Game) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (body: CreateDashboardBody) => fetchApi('/dashboards', DashboardSchema, { method: 'POST', json: body }),
        // The starter is stored by the first write, so the list is read again rather than patched.
        onSuccess: () => queryClient.invalidateQueries({ queryKey: dashboardsKey(game) }),
    });
}

export function useSaveDashboard(game: Game) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, ...body }: SaveDashboardBody & { id: string }) => fetchApi('/dashboards/' + id, DashboardSchema, { method: 'PUT', json: body }),
        onSuccess: (dashboard) => queryClient.setQueryData(dashboardsKey(game), (list: DashboardsResponse | undefined) => withDashboard(list, dashboard)),
    });
}

export function useDeleteDashboard(game: Game) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => sendApi('/dashboards/' + id, { method: 'DELETE' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: dashboardsKey(game) }),
    });
}

export function useReorderDashboards(game: Game) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (ids: string[]) => sendApi('/dashboards/order', { method: 'PUT', json: { game, ids } }),
        onSettled: () => queryClient.invalidateQueries({ queryKey: dashboardsKey(game) }),
    });
}

/** The dashboard as stored now, when a save was refused because another tab saved first; undefined for any other error. */
export function toCurrentDashboard(error: unknown): Dashboard | undefined {
    if (!(error instanceof ApiError) || error.status !== 409 || error.code !== DASHBOARD_CHANGED_CODE) return undefined;

    const details = typeof error.details === 'object' && error.details !== null ? (error.details as Record<string, unknown>) : {};
    const parsed = DashboardSchema.safeParse(details['current']);

    return parsed.success ? parsed.data : undefined;
}
