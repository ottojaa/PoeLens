import { z } from 'zod';
import { ColorModeSchema, ThemeIdSchema } from '../../domain/themes.js';
import { UnitChoiceSchema } from '../../domain/units.js';

/**
 * What a user chose and wants on every device. Every key is optional: a key that was never set means "use the default",
 * and the web app falls back to what the browser last had.
 */
export const PreferencesSchema = z.object({
    theme: ThemeIdSchema.optional(),
    mode: ColorModeSchema.optional(),
    unit: UnitChoiceSchema.optional(),
});

export type Preferences = z.infer<typeof PreferencesSchema>;

/**
 * Reads stored preferences. A value that is no longer valid (a theme that was removed, a unit renamed) is dropped on its
 * own, and the other keys stay: stale data must never make the settings unreadable.
 */
export function parsePreferences(raw: unknown): Preferences {
    if (typeof raw !== 'object' || raw === null) return {};

    const stored = raw as Record<string, unknown>;
    const theme = ThemeIdSchema.safeParse(stored['theme']);
    const mode = ColorModeSchema.safeParse(stored['mode']);
    const unit = UnitChoiceSchema.safeParse(stored['unit']);

    return {
        ...(theme.success ? { theme: theme.data } : {}),
        ...(mode.success ? { mode: mode.data } : {}),
        ...(unit.success ? { unit: unit.data } : {}),
    };
}
