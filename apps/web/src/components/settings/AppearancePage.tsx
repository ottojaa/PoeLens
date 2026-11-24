import { THEMES } from '@/theme/themes';
import { useTheme } from '@/lib/theme';
import { ModeControl } from './ModeControl';
import { ThemeCard } from './ThemeCard';

/** Pick the theme and the colour mode. Both apply at once and follow the account to every device. */
export function AppearancePage() {
    const { theme, mode, isDark, setTheme, setMode } = useTheme();

    return (
        <div className="flex max-w-3xl flex-col gap-8">
            <div>
                <h1 className="font-heading text-[30px] leading-tight font-bold">Appearance</h1>
                <p className="text-muted-foreground mt-1 max-w-xl text-sm">
                    Your choice is saved with your account, so it follows you to every device you sign in on.
                </p>
            </div>
            <section aria-labelledby="mode-heading" className="flex flex-col gap-3">
                <h2 id="mode-heading" className="text-base font-semibold">
                    Mode
                </h2>
                <ModeControl value={mode} onChange={setMode} />
                {mode === 'system' && <p className="text-muted-foreground text-sm">Follows your device: {isDark ? 'dark' : 'light'} right now.</p>}
            </section>
            <section aria-labelledby="theme-heading" className="flex flex-col gap-3">
                <h2 id="theme-heading" className="text-base font-semibold">
                    Theme
                </h2>
                <div className="grid gap-4 sm:grid-cols-3">
                    {THEMES.map(({ id, label }) => (
                        <ThemeCard key={id} id={id} label={label} selected={id === theme} isDark={isDark} onSelect={() => setTheme(id)} />
                    ))}
                </div>
            </section>
        </div>
    );
}
