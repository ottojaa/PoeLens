import { cn } from '@/lib/utils';
import { TogglePop } from '@/motion/TogglePop';

/** The star the design draws: outlined when not watched, filled and stroked in the accent when watched. */
export function StarIcon({ filled, className }: { filled: boolean; className?: string }) {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className={className}>
            <path
                d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"
                fill={filled ? 'currentColor' : 'none'}
                strokeWidth="1.6"
                strokeLinejoin="round"
                stroke="currentColor"
            />
        </svg>
    );
}

/**
 * The 32px star button of the economy table, the phone cards and the lists. It is a plain control: the page owns the
 * watchlist (one `useWatchlist` per view) and passes down the state and the toggle.
 */
export function WatchStar({
    name,
    watched,
    onToggle,
    className,
}: {
    name: string;
    watched: boolean;
    onToggle: (watched: boolean) => void;
    className?: string;
}) {
    return (
        <button
            type="button"
            aria-pressed={watched}
            aria-label={`${watched ? 'Remove' : 'Add'} ${name} ${watched ? 'from' : 'to'} the watchlist`}
            onClick={() => onToggle(!watched)}
            className={cn(
                'focus-visible:ring-ring/50 grid size-8 shrink-0 cursor-pointer place-items-center rounded-md outline-none focus-visible:ring-[3px]',
                watched ? 'text-primary' : 'text-input',
                className,
            )}
        >
            <TogglePop state={watched}>
                <StarIcon filled={watched} />
            </TogglePop>
        </button>
    );
}
