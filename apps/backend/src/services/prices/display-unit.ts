import { DEFAULT_UNIT, type Game, type Prices, type Unit, type UnitChoice } from '@poelens/shared';

/** A step of a ladder: a price of at least `min` in `unit` reads in that unit. */
interface Step {
    unit: Unit;
    min: number;
}

/**
 * How much under a step's minimum a price still counts as reaching it. poe.ninja quotes every price in divine and the
 * other units are that times a rate, so the unit orb's own price in its own unit lands a hair under 1 (the Chaos Orb is
 * 0.99994 c). Without the margin it would read "33 ex", and flip back to "1 c" on a refresh whose rate rounds the other way.
 */
const STEP_MARGIN = 0.001;

/**
 * Per game, from the largest unit down: the first step a row's price reaches is its unit, and below every step it is in
 * `floor`. A game with no entry has no ladder yet, and Auto shows its rows in its default unit.
 */
const LADDERS: Partial<Record<Game, { steps: readonly Step[]; floor: Unit }>> = {
    poe2: {
        steps: [
            { unit: 'divine', min: 1 },
            { unit: 'chaos', min: 1 },
        ],
        floor: 'exalted',
    },
};

/** The unit a row's price is shown in: a fixed choice itself, and under `auto` the largest unit the price reaches 1 of. */
export function toRowUnit(choice: UnitChoice, prices: Prices, game: Game): Unit {
    if (choice !== 'auto') return choice;

    const ladder = LADDERS[game];

    if (!ladder) return DEFAULT_UNIT[game];

    const reached = ladder.steps.find((step) => prices[step.unit] >= step.min * (1 - STEP_MARGIN));

    return reached?.unit ?? ladder.floor;
}
