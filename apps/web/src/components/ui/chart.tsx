import * as React from 'react';
import { ResponsiveContainer, Tooltip } from 'recharts';

import { cn } from '@/lib/utils';

/** One chart series: its label and its colour, a CSS colour such as `var(--chart-1)`. */
export type ChartConfig = Record<string, { label: string; color: string }>;

/**
 * shadcn's chart wrapper over Recharts, trimmed to what PoeLens draws. Each series' colour becomes a `--color-<key>`
 * custom property, so the chart's strokes and fills name `var(--color-price)` and follow the theme's `--chart-*` tokens
 * in light and dark. Recharts's own default grid and axis colours are repointed at the theme here too.
 */
export function ChartContainer({
    config,
    className,
    children,
    ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & { config: ChartConfig; children: React.ReactElement }) {
    const colours = Object.fromEntries(Object.entries(config).map(([key, { color }]) => [`--color-${key}`, color]));

    return (
        <div
            data-slot="chart"
            style={colours as React.CSSProperties}
            className={cn(
                'flex aspect-video justify-center text-xs',
                '[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground',
                '[&_.recharts-cartesian-grid_line]:stroke-border',
                '[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border',
                '[&_.recharts-surface]:overflow-visible',
                className,
            )}
            {...props}
        >
            <ResponsiveContainer>{children}</ResponsiveContainer>
        </div>
    );
}

export const ChartTooltip = Tooltip;

/** The tooltip card's frame, for a chart's own tooltip content to sit in. */
export function ChartTooltipFrame({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            className={cn('bg-popover text-popover-foreground border-border grid min-w-40 gap-1 rounded-lg border px-3 py-2 text-xs shadow-xl', className)}
            {...props}
        />
    );
}
