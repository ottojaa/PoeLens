import { CATEGORIES } from '@poelens/shared';
import { Link, useParams, useRouterState } from '@tanstack/react-router';
import { Button, buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { LeagueSwitcher } from './LeagueSwitcher';
import { CategoryNav, NAV_ITEM_CLASS, NavHeading } from './CategoryNav';
import { Soon } from './Soon';
import { useWatchlist } from '@/lib/api/watchlist';
import { GAME, useEconomyContext } from '@/lib/economy/use-economy-context';
import { cn } from '@/lib/utils';

/** The way to the watchlist, with how many items are on it once that is known. */
function WatchlistLink({ onNavigate }: { onNavigate?: () => void }) {
    const { count, answer } = useWatchlist();
    const { location } = useRouterState();
    const isCurrent = location.pathname === '/watchlist';

    return (
        <Link
            to="/watchlist"
            aria-current={isCurrent ? 'page' : undefined}
            onClick={onNavigate}
            className={cn(buttonVariants({ variant: 'ghost' }), NAV_ITEM_CLASS, isCurrent && 'bg-accent text-foreground')}
        >
            Watchlist
            {answer && <span className="text-foreground font-semibold tabular-nums">{count}</span>}
        </Link>
    );
}

/** The category list plus the personal sections (the tokens arrive later, so they stay a placeholder). */
function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
    const { category } = useParams({ strict: false });

    return (
        <nav aria-label="Sections" className="flex flex-col gap-0.5">
            <CategoryNav categories={CATEGORIES[GAME]} value={category ?? null} onNavigate={onNavigate} />
            <NavHeading>Yours</NavHeading>
            <WatchlistLink onNavigate={onNavigate} />
            <Button type="button" variant="ghost" disabled className={NAV_ITEM_CLASS}>
                MCP &amp; API tokens <Soon />
            </Button>
        </nav>
    );
}

/** The sidebar beside the page from `md` up. */
export function Sidebar() {
    return (
        <aside className="bg-card sticky top-[var(--header-height)] hidden h-[calc(100svh-var(--header-height))] w-60 shrink-0 self-start overflow-y-auto border-r p-3 md:block">
            <SidebarNav />
        </aside>
    );
}

/** The same navigation as a drawer, for phones. It also holds the league control the header only has from `md`. */
export function SidebarDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const { leagues, league, setLeague } = useEconomyContext();

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="left" className="overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                    <SheetDescription className="sr-only">Categories and your sections</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-3 px-3 pb-6">
                    <LeagueSwitcher leagues={leagues ?? []} value={league?.name ?? null} onChange={setLeague} />
                    <SidebarNav onNavigate={() => onOpenChange(false)} />
                </div>
            </SheetContent>
        </Sheet>
    );
}
