import { z } from 'zod';

/**
 * The colour themes the app ships. The ids live here so the API can validate a saved choice; the labels, colours and
 * fonts live with the web app's theme files, which must have one theme per id (its theme test checks).
 */
export const ThemeIdSchema = z.enum(['reverie', 'slate', 'graphite']);

export type ThemeId = z.infer<typeof ThemeIdSchema>;

export const THEME_IDS = ThemeIdSchema.options;

/** The theme a viewer gets until they pick one. */
export const DEFAULT_THEME_ID: ThemeId = 'reverie';

/** Dark, light, or whichever the device is set to (`system`). */
export const ColorModeSchema = z.enum(['dark', 'light', 'system']);

export type ColorMode = z.infer<typeof ColorModeSchema>;

export const COLOR_MODES = ColorModeSchema.options;

/** The mode a viewer gets until they pick one: the game is dark. */
export const DEFAULT_COLOR_MODE: ColorMode = 'dark';
