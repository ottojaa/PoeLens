import { DASHBOARD_CHANGED_CODE, type Dashboard } from '@poelens/shared';
import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { toCurrentDashboard } from './dashboards';

const dashboard: Dashboard = {
    id: '3f1c1f5e-5b0a-4a3e-9d57-0c9f7a2d1b11',
    game: 'poe2',
    name: 'Trading',
    position: 0,
    revision: 4,
    panels: [],
};

describe('toCurrentDashboard', () => {
    it('reads the stored dashboard out of a refused save', () => {
        const error = new ApiError(409, '/dashboards/x', DASHBOARD_CHANGED_CODE, 'changed', { current: dashboard });

        expect(toCurrentDashboard(error)).toEqual(dashboard);
    });

    it('is undefined for a refusal that carries no dashboard, or one that is not a 409', () => {
        expect(toCurrentDashboard(new ApiError(409, '/dashboards/x', DASHBOARD_CHANGED_CODE, 'changed', { current: { nope: true } }))).toBeUndefined();
        expect(toCurrentDashboard(new ApiError(409, '/dashboards/x', 'OTHER', 'changed', { current: dashboard }))).toBeUndefined();
        expect(toCurrentDashboard(new ApiError(500, '/dashboards/x', DASHBOARD_CHANGED_CODE, null, { current: dashboard }))).toBeUndefined();
        expect(toCurrentDashboard(new Error('offline'))).toBeUndefined();
        expect(toCurrentDashboard(undefined)).toBeUndefined();
    });
});
