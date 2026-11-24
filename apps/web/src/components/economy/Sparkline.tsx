import { toChangeDirection } from '@/lib/format';
import { buildSparklinePath, SPARKLINE_HEIGHT, SPARKLINE_WIDTH, toTrendChange } from '@/lib/economy/sparkline';
import { CHANGE_TEXT_CLASS } from './Change';

/**
 * A week of daily prices as a line, coloured by the 7 day change (up, down, or neutral) and drawn in once when it
 * first appears. With fewer than two points there is nothing to draw, so the box stays empty.
 */
export function Sparkline({ points, change }: { points: readonly number[] | undefined; change: number | null }) {
    const path = buildSparklinePath(points);
    const direction = toChangeDirection(change ?? toTrendChange(points));
    const label = path ? `Price over the last 7 days, ${direction === 'flat' ? 'about flat' : direction === 'up' ? 'rising' : 'falling'}` : 'No trend yet';

    return (
        <svg
            width={SPARKLINE_WIDTH}
            height={SPARKLINE_HEIGHT}
            viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
            role="img"
            aria-label={label}
            className={CHANGE_TEXT_CLASS[direction]}
        >
            {path && (
                <path
                    d={path}
                    pathLength={1}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="sparkline-draw"
                />
            )}
        </svg>
    );
}
