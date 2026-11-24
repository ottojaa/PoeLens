import type { Game, League, Unit } from '@poelens/shared';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback } from 'react';
import { useLeagues, type PriceScope } from '@/lib/api/prices';
import { loadStoredUnit, resolveUnit, storeUnit } from './units';

/** PoE 1 gets its own switch when its collector exists; every price view is PoE 2 until then. */
export const GAME: Game = 'poe2';

export interface EconomyContext {
    /** What to ask the API for: the league in the URL, else `'current'`, which the API resolves. */
    scope: PriceScope;
    /** Every league of the game; undefined until the list has loaded. */
    leagues: readonly League[] | undefined;
    /** The league the URL points at (`'current'` resolved), once the list has loaded and if it has such a league. */
    league: League | undefined;
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
    const leagueList = useLeagues(GAME).data?.leagues;
    const leagueParam = search.league ?? 'current';
    const unit = resolveUnit(search.unit, loadStoredUnit(), GAME);
    const league = leagueList?.find((candidate) => (leagueParam === 'current' ? candidate.current && !candidate.hardcore : candidate.name === leagueParam));

    const setLeague = useCallback((next: string) => void navigate({ to: '.', search: (previous) => ({ ...previous, league: next }) }), [navigate]);
    const setUnit = useCallback(
        (next: Unit) => {
            storeUnit(next);
            void navigate({ to: '.', search: (previous) => ({ ...previous, unit: next }) });
        },
        [navigate],
    );

    return { scope: { game: GAME, league: leagueParam, unit }, leagues: leagueList, league, setLeague, setUnit };
}
