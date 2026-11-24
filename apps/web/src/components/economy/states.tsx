import { SearchX, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function StateBox({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
    return (
        <div role="status" className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <span className="text-muted-foreground">{icon}</span>
            <p className="font-semibold">{title}</p>
            {children && <div className="text-muted-foreground flex max-w-md flex-col items-center gap-3 text-sm">{children}</div>}
        </div>
    );
}

/** Placeholder rows with the table's rhythm, while the first answer loads. */
export function TableSkeleton({ rows = 10 }: { rows?: number }) {
    return (
        <div className="flex flex-col" aria-busy="true" aria-label="Loading prices">
            {Array.from({ length: rows }, (_, index) => (
                <div key={index} className="flex items-center gap-4 border-t px-4 py-3 first:border-t-0">
                    <Skeleton className="size-8 rounded-lg" />
                    <div className="flex flex-1 flex-col gap-1.5">
                        <Skeleton className="h-4 w-40 max-w-full" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="hidden h-4 w-14 sm:block" />
                    <Skeleton className="hidden h-6 w-24 md:block" />
                </div>
            ))}
        </div>
    );
}

export function ErrorState({
    title = 'Could not load prices',
    message = 'The price service did not answer as expected. Your view is unchanged.',
    onRetry,
}: {
    title?: string;
    message?: string;
    /** Left out when trying again cannot help, such as a link to something that does not exist. */
    onRetry?: () => void;
}) {
    return (
        <StateBox icon={<TriangleAlert className="size-6" aria-hidden="true" />} title={title}>
            <p>{message}</p>
            {onRetry && (
                <Button type="button" variant="outline" onClick={onRetry}>
                    Try again
                </Button>
            )}
        </StateBox>
    );
}

/** A category or league the collector has no prices for yet. */
export function NoDataState({ league }: { league: string | undefined }) {
    return (
        <StateBox icon={<SearchX className="size-6" aria-hidden="true" />} title="No prices here yet">
            <p>
                {league ? `The collector has not stored prices for ${league} in this category.` : 'The collector has not stored prices for this category.'} They
                appear after its next fetch.
            </p>
        </StateBox>
    );
}

/** An item the collector has no price for in this league, such as one seen only in another league. */
export function NoItemPriceState({ league }: { league: string }) {
    return (
        <StateBox icon={<SearchX className="size-6" aria-hidden="true" />} title={`No price in ${league} right now`}>
            <p>This item has not been priced in this league. Pick another league from the league menu.</p>
        </StateBox>
    );
}

/** Rows exist, but the filters hide all of them. */
export function NoMatchState({ onClear }: { onClear: () => void }) {
    return (
        <StateBox icon={<SearchX className="size-6" aria-hidden="true" />} title="Nothing matches these filters">
            <Button type="button" variant="outline" onClick={onClear}>
                Clear filters
            </Button>
        </StateBox>
    );
}
