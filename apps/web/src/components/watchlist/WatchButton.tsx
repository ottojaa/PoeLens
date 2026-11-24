import { StarIcon } from '@/components/watchlist/WatchStar';
import { cn } from '@/lib/utils';
import { TogglePop } from '@/motion/TogglePop';

function toLabel(ready: boolean, watched: boolean): string {
    if (!ready) return 'Watchlist';

    return watched ? 'On your watchlist' : 'Add to watchlist';
}

/**
 * The watch button of the item page: the accent when watched, an outline button when not. Until the watchlist has
 * answered it is disabled and says just "Watchlist", so a watched item never shows "Add to watchlist" for a moment.
 */
export function WatchButton({ ready, watched, onToggle }: { ready: boolean; watched: boolean; onToggle: (watched: boolean) => void }) {
    return (
        <button
            type="button"
            aria-pressed={watched}
            disabled={!ready}
            onClick={() => onToggle(!watched)}
            className={cn(
                'focus-visible:ring-ring/50 flex min-h-11 cursor-pointer items-center disabled:cursor-default disabled:opacity-60 gap-2 rounded-[10px] px-[18px] text-[15px] outline-none focus-visible:ring-[3px]',
                watched ? 'bg-primary text-primary-foreground font-semibold' : 'border-input text-foreground hover:bg-accent border',
            )}
        >
            <TogglePop state={watched}>
                <StarIcon filled={watched} strokeWidth={watched ? 0 : 1.6} />
            </TogglePop>
            {toLabel(ready, watched)}
        </button>
    );
}
