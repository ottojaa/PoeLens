import { DEFAULT_COLOR_MODE, DEFAULT_THEME_ID, type ColorMode, type ThemeId } from '@poelens/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useAccountPreferences, useSavePreferences } from '@/lib/api/preferences';
import { useAuth } from '@/lib/auth';
import { storeAppearance, useAppearanceCache } from '@/lib/preferences/appearance-cache';
import { useMediaQuery } from '@/lib/use-media-query';

interface ThemeContextValue {
    theme: ThemeId;
    /** What the user chose: dark, light, or follow the device. */
    mode: ColorMode;
    /** What is showing: `mode` with System resolved against the device. */
    isDark: boolean;
    setTheme: (theme: ThemeId) => void;
    setMode: (mode: ColorMode) => void;
    /** The quick toggle: the opposite of what is showing, as an explicit mode. */
    toggleDark: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * The theme and mode: the account's choice when signed in, else this browser's, else Reverie in dark. The browser keeps a
 * copy of whatever is showing (see `index.html`, which paints it before React loads), so a reload never flashes.
 * Must sit inside the auth and query providers.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
    const { state } = useAuth();
    const account = useAccountPreferences();
    const save = useSavePreferences();
    const cache = useAppearanceCache();
    const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
    const theme = account?.theme ?? cache.theme ?? DEFAULT_THEME_ID;
    const mode = account?.mode ?? cache.mode ?? DEFAULT_COLOR_MODE;
    const isDark = mode === 'system' ? systemDark : mode === 'dark';
    const isSignedIn = state.status === 'signedIn';

    useEffect(() => {
        document.documentElement.dataset['theme'] = theme;
        document.documentElement.classList.toggle('dark', isDark);
        storeAppearance({ theme, mode });
    }, [theme, mode, isDark]);

    const choose = useCallback(
        (patch: { theme?: ThemeId; mode?: ColorMode }) => {
            // Signed in, the account's answer drives the screen and the effect above copies it to the browser.
            if (!isSignedIn) return storeAppearance(patch);

            save(patch);
        },
        [isSignedIn, save],
    );

    const value = useMemo<ThemeContextValue>(
        () => ({
            theme,
            mode,
            isDark,
            setTheme: (next) => choose({ theme: next }),
            setMode: (next) => choose({ mode: next }),
            toggleDark: () => choose({ mode: isDark ? 'light' : 'dark' }),
        }),
        [theme, mode, isDark, choose],
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext);

    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');

    return ctx;
}
