/** Whether a series has the two points a line needs. */
export function hasLine(points: readonly number[] | undefined): points is readonly number[] {
    return points !== undefined && points.length >= 2;
}

/** The change from a series' first point to its last, in percent. Null without a line, or from a zero start. */
export function toTrendChange(points: readonly number[] | undefined): number | null {
    if (!hasLine(points)) return null;

    const first = points[0] ?? 0;
    const last = points[points.length - 1] ?? 0;

    if (first === 0) return null;

    return ((last - first) / first) * 100;
}
