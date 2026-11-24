import { hasLine } from '@poelens/shared';

export { hasLine, toTrendChange } from '@poelens/shared';

export const SPARKLINE_WIDTH = 96;
export const SPARKLINE_HEIGHT = 28;
/** Keeps a line's stroke and round caps inside the viewBox. */
const PADDING = 2;

/**
 * The SVG path of a sparkline in a `width` x `height` box: points spread evenly left to right, the lowest at the
 * bottom and the highest at the top. A flat series is a line across the middle. Fewer than two points have no line,
 * so the path is empty.
 */
export function buildSparklinePath(points: readonly number[] | undefined, width = SPARKLINE_WIDTH, height = SPARKLINE_HEIGHT): string {
    if (!hasLine(points)) return '';

    const low = Math.min(...points);
    const span = Math.max(...points) - low;
    const usable = height - 2 * PADDING;
    const step = (width - 2 * PADDING) / (points.length - 1);

    return points
        .map((point, index) => {
            const x = PADDING + index * step;
            const y = span === 0 ? height / 2 : PADDING + usable * (1 - (point - low) / span);

            return (index === 0 ? 'M' : 'L') + round(x) + ' ' + round(y);
        })
        .join(' ');
}

function round(value: number): number {
    return Math.round(value * 100) / 100;
}
