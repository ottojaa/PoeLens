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

const COUNT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const MINUS = '−';

/** A price for reading at a glance: fewer decimals the larger it gets, and millions as "1.25M". */
export function formatPrice(value: number): string {
    const magnitude = Math.abs(value);

    if (magnitude >= 1_000_000) return (value / 1_000_000).toFixed(2) + 'M';

    if (magnitude >= 1_000) return COUNT.format(value);

    if (magnitude >= 100) return value.toFixed(1);

    if (magnitude >= 1) return value.toFixed(2);

    if (magnitude >= 0.001) return value.toFixed(3);

    return value === 0 ? '0' : value.toPrecision(2);
}

/** A whole number with thousands separators. */
export function formatCount(value: number): string {
    return COUNT.format(value);
}

/** A row's liquidity: traded volume is in divine and can be a fraction, listings are whole. */
export function formatLiquidity(liquidity: { kind: 'listings' | 'volume'; value: number }): string {
    return liquidity.kind === 'volume' ? formatPrice(liquidity.value) : formatCount(liquidity.value);
}

/** A row's liquidity with its own unit, for lists that mix categories: "10.4 div" traded, or "868 listings". */
export function formatLiquidityWithUnit(liquidity: { kind: 'listings' | 'volume'; value: number }): string {
    return liquidity.kind === 'volume'
        ? `${formatPrice(liquidity.value)} div`
        : `${formatCount(liquidity.value)} ${liquidity.value === 1 ? 'listing' : 'listings'}`;
}

/** A change in percent with an arrow, so direction never rests on colour alone: "▲ +29.6%", "▼ −3.9%". Null is "—". */
export function formatChange(percent: number | null): string {
    if (percent === null) return '—';

    const rounded = Math.abs(percent).toFixed(1);

    if (rounded === '0.0') return '0.0%';

    return percent > 0 ? `▲ +${rounded}%` : `▼ ${MINUS}${rounded}%`;
}

export type ChangeDirection = 'up' | 'down' | 'flat';

/** Which way a change points, by what {@link formatChange} would show: a change that rounds to zero is flat. */
export function toChangeDirection(percent: number | null): ChangeDirection {
    if (percent === null || Math.abs(percent).toFixed(1) === '0.0') return 'flat';

    return percent > 0 ? 'up' : 'down';
}

const AGO_STEPS = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
] as const;

/** "just now", "12 minutes ago", "3 hours ago", "2 days ago". */
export function formatAgo(from: Date | string, now: Date = new Date()): string {
    const seconds = Math.max(0, (now.getTime() - new Date(from).getTime()) / 1000);
    const step = AGO_STEPS.find(([, size]) => seconds >= size);

    if (!step) return 'just now';

    const amount = Math.floor(seconds / step[1]);

    return `${amount} ${step[0]}${amount === 1 ? '' : 's'} ago`;
}

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const DATE_TIME = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });

/** "24 Nov 2026", in UTC like every bucket the API returns. */
export function formatDate(value: Date | string): string {
    return DATE.format(new Date(value));
}

/** "24 Nov, 14:00 UTC". */
export function formatDateTime(value: Date | string): string {
    return DATE_TIME.format(new Date(value)) + ' UTC';
}
