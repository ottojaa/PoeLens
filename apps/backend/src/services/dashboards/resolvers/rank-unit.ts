import { DEFAULT_UNIT, type Game, type Unit, type UnitChoice } from '@poelens/shared';

/** Changes only rank against each other in one unit: the panel's if it is fixed, else the game's default. */
export function toRankUnit(game: Game, unit: UnitChoice): Unit {
    return unit === 'auto' ? DEFAULT_UNIT[game] : unit;
}
