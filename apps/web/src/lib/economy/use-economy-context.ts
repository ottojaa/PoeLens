import type { Game, Unit } from '@poelens/shared';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';
import { useLeagues, type PriceScope } from '@/lib/api/prices';
import { loadStoredUnit, resolveUnit, storeUnit } from './units';

/** PoE 1 gets its own switch when its collector exists; every price view is PoE 2 until then. */
export const GAME: Game = 'poe2';

export interface EconomyContext {
    /** What to ask the API for: the league in the URL, else `'current'`, which the API resolves. */
    scope: PriceScope;
    /** The league's real name, once the league list has loaded, for the switcher and the item page. */
    leagueName: string | undefined;
    setLeague: (league: string) => void;
    setUnit: (unit: Unit) => void;
}

/**
 * The league and unit every page shares. They live in the URL (the root route carries them across navigation), and
 * the unit also in the browser, so a bare link opens in the unit last picked.
 */
export function useEconomyContext(): EconomyContext {
    const search = useSearch({ from: '__root__' });
    const navigate = useNavigate();
    const leagues = useLeagues(GAME);
    const league = search.league ?? 'current';
    const unit = resolveUnit(search.unit, loadStoredUnit(), GAME);
    const leagueName = leagues.data?.leagues.find((candidate) =>
        league === 'current' ? candidate.current && !candidate.hardcore : candidate.name === league,
    )?.name;

    const setLeague = useCallback((next: string) => void navigate({ to: '.', search: (previous) => ({ ...previous, league: next }) }), [navigate]);
    const setUnit = useCallback(
        (next: Unit) => {
            storeUnit(next);
            void navigate({ to: '.', search: (previous) => ({ ...previous, unit: next }) });
        },
        [navigate],
    );

    return { scope: { game: GAME, league, unit }, leagueName, setLeague, setUnit };
}
