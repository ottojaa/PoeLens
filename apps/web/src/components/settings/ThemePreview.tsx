import { cn } from '@/lib/utils';

/**
 * A miniature of the app in one theme. The wrapper carries `data-theme` (and `.dark`), so every token below resolves
 * to that theme's values whatever the page is showing. Only token classes appear here: a `dark:` variant would follow
 * the page's `.dark`, not this preview's.
 */
export function ThemePreview({ theme, isDark }: { theme: string; isDark: boolean }) {
    return (
        <div data-theme={theme} className={cn('bg-background text-foreground flex flex-col gap-2 rounded-lg p-3', isDark && 'dark')} aria-hidden="true">
            <div className="flex items-center justify-between">
                <span className="font-heading text-2xl leading-none font-semibold">Aa</span>
                <span className="bg-primary text-primary-foreground rounded-md px-2 py-1 text-[11px] leading-none font-medium">Button</span>
            </div>
            <div className="bg-card border-border flex flex-col gap-1.5 rounded-md border p-2 text-xs">
                <div className="flex items-center justify-between">
                    <span>Divine Orb</span>
                    <span className="text-up font-medium">▲ 4.2%</span>
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Exalted Orb</span>
                    <span className="text-down font-medium">▼ 1.8%</span>
                </div>
            </div>
        </div>
    );
}
