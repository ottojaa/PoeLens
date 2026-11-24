import type { HistoryBucket, Unit } from '@poelens/shared';
import { useReducedMotion } from 'motion/react';
import { useId, useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import type { TooltipContentProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { ChartContainer, ChartTooltip, ChartTooltipFrame, type ChartConfig } from '@/components/ui/chart';
import type { ChartPoint } from '@/lib/economy/history';
import { UNIT_SHORT } from '@/lib/economy/units';
import { formatDate, formatDateTime, formatPrice } from '@/lib/format';
import { DURATION } from '@/motion/tokens';
import { Change } from './Change';

const CONFIG = { price: { label: 'Price', color: 'var(--chart-1)' } } satisfies ChartConfig;

const TICK_HOUR = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
const TICK_DAY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function toTick(bucket: HistoryBucket, spanMs: number) {
    return (time: number) => (bucket === 'hour' && spanMs <= 86_400_000 * 1.5 ? TICK_HOUR : TICK_DAY).format(time);
}

function PointTooltip({ active, payload, bucket, unit }: Partial<TooltipContentProps<ValueType, NameType>> & { bucket: HistoryBucket; unit: Unit }) {
    const point = payload?.[0]?.payload as ChartPoint | undefined;

    if (!active || !point) return null;

    return (
        <ChartTooltipFrame>
            <span className="text-muted-foreground">{bucket === 'hour' ? formatDateTime(new Date(point.time)) : formatDate(new Date(point.time))}</span>
            <span className="text-sm font-semibold">
                {formatPrice(point.price)} {UNIT_SHORT[unit]}
            </span>
            <span className="text-muted-foreground flex items-center gap-1">
                <Change percent={point.change} /> from the previous point
            </span>
        </ChartTooltipFrame>
    );
}

/**
 * The price line over a range. It draws in once, the first time the chart is shown: later range, unit or refresh
 * changes swap the data without replaying it, and reduced motion skips the drawing altogether.
 */
export function HistoryChart({ points, bucket, unit, label }: { points: readonly ChartPoint[]; bucket: HistoryBucket; unit: Unit; label: string }) {
    const reduceMotion = useReducedMotion();
    const [drawn, setDrawn] = useState(false);
    const gradientId = useId();
    const first = points[0]?.time ?? 0;
    const last = points[points.length - 1]?.time ?? 0;

    return (
        <ChartContainer config={CONFIG} className="aspect-auto h-72 w-full" role="img" aria-label={label}>
            <AreaChart data={[...points]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-price)" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="var(--color-price)" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                    dataKey="time"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={toTick(bucket, last - first)}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={48}
                    tickMargin={8}
                />
                <YAxis domain={['auto', 'auto']} tickFormatter={formatPrice} tickLine={false} axisLine={false} width={56} />
                <ChartTooltip cursor content={(props) => <PointTooltip {...props} bucket={bucket} unit={unit} />} />
                <Area
                    dataKey="price"
                    type="linear"
                    stroke="var(--color-price)"
                    strokeWidth={2}
                    fill={`url(#${gradientId})`}
                    dot={points.length <= 2}
                    activeDot={{ r: 4 }}
                    isAnimationActive={!drawn && !reduceMotion}
                    animationDuration={DURATION.chart * 1000}
                    animationEasing="ease-out"
                    onAnimationEnd={() => setDrawn(true)}
                />
            </AreaChart>
        </ChartContainer>
    );
}
