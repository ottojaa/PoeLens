/** Motion timing in seconds, the unit Motion takes. `motion.css` holds the same numbers for the CSS animations. */
export const DURATION = {
    page: 0.18,
    menu: 0.12,
    palette: 0.14,
    sheet: 0.24,
    number: 0.4,
    chart: 0.6,
} as const;

export const EASE_OUT = [0, 0, 0.2, 1] as const;

/** The spring that lists glide and toggles pop with. */
export const SPRING = { type: 'spring', stiffness: 500, damping: 32, mass: 0.8 } as const;

/** The bounce of a toggle that just changed. */
export const POP_SPRING = { type: 'spring', stiffness: 600, damping: 14 } as const;
