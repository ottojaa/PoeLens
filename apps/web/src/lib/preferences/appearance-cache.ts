import { ColorModeSchema, ThemeIdSchema, type ColorMode, type ThemeId } from '@poelens/shared';
import { useSyncExternalStore } from 'react';

/** Where this browser remembers the theme and mode, so the page paints right before the account's answer arrives. `index.html` reads the same keys. */
export const THEME_STORAGE_KEY = 'poelens-theme';
export const MODE_STORAGE_KEY = 'poelens-mode';

export interface AppearanceCache {
    theme?: ThemeId;
    mode?: ColorMode;
}

function readStorage(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

/** Storage can be missing or full, so a failed write just means the next visit starts from the default. */
function writeStorage(key: string, value: string): void {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        // Nothing to do: the choice still holds for this visit.
    }
}

function loadCache(): AppearanceCache {
    const theme = ThemeIdSchema.safeParse(readStorage(THEME_STORAGE_KEY));
    const mode = ColorModeSchema.safeParse(readStorage(MODE_STORAGE_KEY));

    return { ...(theme.success && { theme: theme.data }), ...(mode.success && { mode: mode.data }) };
}

const EMPTY: AppearanceCache = {};
const listeners = new Set<() => void>();
let current: AppearanceCache | null = null;

function replace(next: AppearanceCache): void {
    const unchanged = next.theme === current?.theme && next.mode === current?.mode;

    if (unchanged) return;

    current = next;
    listeners.forEach((notify) => notify());
}

/** The stored choices; the same object until one of them changes. */
export function getAppearanceCache(): AppearanceCache {
    if (typeof window === 'undefined') return EMPTY;

    current ??= loadCache();

    return current;
}

/** Remembers the theme and/or mode in this browser. */
export function storeAppearance(patch: AppearanceCache): void {
    if (patch.theme) writeStorage(THEME_STORAGE_KEY, patch.theme);

    if (patch.mode) writeStorage(MODE_STORAGE_KEY, patch.mode);

    replace({ ...getAppearanceCache(), ...patch });
}

function subscribe(notify: () => void): () => void {
    const onStorage = (event: StorageEvent) => {
        if (event.key !== THEME_STORAGE_KEY && event.key !== MODE_STORAGE_KEY) return;

        // Another tab changed it.
        replace(loadCache());
    };

    listeners.add(notify);
    window.addEventListener('storage', onStorage);

    return () => {
        listeners.delete(notify);
        window.removeEventListener('storage', onStorage);
    };
}

export function useAppearanceCache(): AppearanceCache {
    return useSyncExternalStore(subscribe, getAppearanceCache, () => EMPTY);
}
