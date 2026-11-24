import { DEFAULT_THEME_ID } from '@/theme/themes';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const THEME_KEY = 'poelens-theme';

/** Dark unless the user picked light: the game is dark, and so is everyone's second monitor at 3am. */
function getInitialTheme(): boolean {
    if (typeof window === 'undefined') return true;

    return localStorage.getItem(THEME_KEY) !== 'light';
}

type ThemeContextValue = {
    isDark: boolean;
    setIsDark: (value: boolean | ((prev: boolean) => boolean)) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [isDark, setIsDark] = useState(getInitialTheme);

    useEffect(() => {
        document.documentElement.dataset['theme'] = DEFAULT_THEME_ID;
        document.documentElement.classList.toggle('dark', isDark);
        localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    }, [isDark]);

    return <ThemeContext.Provider value={{ isDark, setIsDark }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext);

    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');

    return ctx;
}
