import { DEFAULT_THEME_ID, THEME_IDS, type ThemeId } from '@poelens/shared';

/**
 * The theme registry. A theme is a CSS file (`<id>.css`) that defines every token below for light and dark; adding one
 * is the id in `@poelens/shared` (what the API accepts), a new file, an `@import` in `styles.css` and a label here.
 * Nothing outside `src/theme/` writes a colour or a font.
 */
export { DEFAULT_THEME_ID, type ThemeId };

const LABELS: Record<ThemeId, string> = { reverie: 'Reverie', slate: 'Slate', graphite: 'Graphite' };

export const THEMES: readonly { id: ThemeId; label: string }[] = THEME_IDS.map((id) => ({ id, label: LABELS[id] }));

/** Colour tokens: each is a hex value, defined once for light and once for dark. */
export const COLOR_TOKENS = [
    'background',
    'foreground',
    'card',
    'card-foreground',
    'popover',
    'popover-foreground',
    'primary',
    'primary-foreground',
    'secondary',
    'secondary-foreground',
    'muted',
    'muted-foreground',
    'accent',
    'accent-foreground',
    'destructive',
    'destructive-foreground',
    'success',
    'warning',
    'border',
    'input',
    'ring',
    'up',
    'down',
    'scrim',
    'chart-1',
    'chart-2',
    'chart-3',
    'chart-4',
    'chart-5',
] as const;

/** Font tokens: the same in light and dark, so they sit in the theme's base block only. */
export const FONT_TOKENS = ['font-title', 'font-body'] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];
