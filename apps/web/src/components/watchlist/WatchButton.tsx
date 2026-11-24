import { cn } from '@/lib/utils';
import { TogglePop } from '@/motion/TogglePop';

/** The watch button of the item page: the accent when watched, an outline button when not. */
export function WatchButton({ watched, onToggle }: { watched: boolean; onToggle: (watched: boolean) => void }) {
    return (
        <button
            type="button"
            aria-pressed={watched}
            onClick={() => onToggle(!watched)}
            className={cn(
                'focus-visible:ring-ring/50 flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] px-[18px] text-[15px] outline-none focus-visible:ring-[3px]',
                watched ? 'bg-primary text-primary-foreground font-semibold' : 'border-input text-foreground hover:bg-accent border',
            )}
        >
            <TogglePop state={watched}>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"
                        fill={watched ? 'currentColor' : 'none'}
                        stroke={watched ? 'none' : 'currentColor'}
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                    />
                </svg>
            </TogglePop>
            {watched ? 'On your watchlist' : 'Add to watchlist'}
        </button>
    );
}
