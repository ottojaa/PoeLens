/** "3d 4h", "2h 5m", "45s": the two largest non-zero units of a duration in seconds. */
export function formatUptime(totalSeconds: number): string {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const units = [
        ['d', Math.floor(seconds / 86_400)],
        ['h', Math.floor((seconds % 86_400) / 3_600)],
        ['m', Math.floor((seconds % 3_600) / 60)],
        ['s', seconds % 60],
    ] as const;
    const parts = units.filter(([, amount]) => amount > 0).slice(0, 2);

    if (parts.length === 0) return '0s';

    return parts.map(([unit, amount]) => amount + unit).join(' ');
}
