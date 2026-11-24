import { Link } from '@tanstack/react-router';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StarIcon } from './WatchStar';

/** What /watchlist says before anything is starred. */
export function EmptyWatchlist() {
    return (
        <div role="status" className="bg-card flex flex-col items-center gap-2 rounded-xl border px-6 py-14 text-center">
            <span className="text-muted-foreground">
                <StarIcon filled={false} />
            </span>
            <p className="font-semibold">Nothing on your watchlist yet.</p>
            <p className="text-muted-foreground max-w-md text-sm">Star items in any category to watch them here.</p>
            <Link to="/economy/$category" params={{ category: 'Currency' }} className={cn(buttonVariants({ variant: 'outline' }), 'mt-2')}>
                Browse Currency
            </Link>
        </div>
    );
}
