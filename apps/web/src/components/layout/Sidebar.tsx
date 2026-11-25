import { CATEGORIES } from '@poelens/shared';
import { Link, useParams, useRouterState } from '@tanstack/react-router';
import { LayoutDashboard } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { LeagueSwitcher } from './LeagueSwitcher';
import { CategoryNav, NAV_ITEM_CLASS, NavHeading } from './CategoryNav';
import { useWatchlist } from '@/lib/api/watchlist';
import { GAME, useEconomyContext } from '@/lib/economy/use-economy-context';
import { cn } from '@/lib/utils';

/** The way to the home page, where the user's dashboards are: the first thing in the menu. */
function DashboardLink({ onNavigate }: { onNavigate?: () => void }) {
    const { location } = useRouterState();
    const isCurrent = location.pathname === '/';

    return (
        <Link
            to="/"
            aria-current={isCurrent ? 'page' : undefined}
            onClick={onNavigate}
            className={cn(buttonVariants({ variant: 'ghost' }), NAV_ITEM_CLASS, 'justify-start gap-2.5 font-medium', isCurrent && 'bg-accent text-foreground')}
        >
            <LayoutDashboard aria-hidden="true" className="size-4" />
            Dashboard
        </Link>
    );
}

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

/** The way to the page where a user makes the tokens Claude connects with. */
function TokensLink({ onNavigate }: { onNavigate?: () => void }) {
    const { location } = useRouterState();
    const isCurrent = location.pathname === '/tokens';

    return (
        <Link
            to="/tokens"
            aria-current={isCurrent ? 'page' : undefined}
            onClick={onNavigate}
            className={cn(buttonVariants({ variant: 'ghost' }), NAV_ITEM_CLASS, isCurrent && 'bg-accent text-foreground')}
        >
            MCP &amp; API tokens
        </Link>
    );
}

/** The category list plus the personal sections. */
function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
    const { category } = useParams({ strict: false });

    return (
        <nav aria-label="Sections" className="flex flex-col gap-0.5">
            <DashboardLink onNavigate={onNavigate} />
            <CategoryNav categories={CATEGORIES[GAME]} value={category ?? null} onNavigate={onNavigate} />
            <NavHeading>Yours</NavHeading>
            <WatchlistLink onNavigate={onNavigate} />
            <TokensLink onNavigate={onNavigate} />
        </nav>
    );
}

/** The sidebar beside the page from `md` up. */
export function Sidebar() {
    return (
        <aside className="bg-panel sticky top-[var(--header-height)] hidden h-[calc(100svh-var(--header-height))] w-60 shrink-0 self-start overflow-y-auto border-r p-3 md:block">
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
