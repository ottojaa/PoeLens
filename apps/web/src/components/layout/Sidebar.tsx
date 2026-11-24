import { CATEGORIES } from '@poelens/shared';
import { useParams } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { LeagueSwitcher } from './LeagueSwitcher';
import { CategoryNav, NAV_ITEM_CLASS, NavHeading } from './CategoryNav';
import { Soon } from './Soon';
import { UnitToggle } from './UnitToggle';
import { GAME, useEconomyContext } from '@/lib/economy/use-economy-context';
import { useLeagues } from '@/lib/api/prices';

/** The category list plus the personal sections (Watchlist and tokens arrive later, so they stay placeholders). */
function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
    const { category } = useParams({ strict: false });

    return (
        <nav aria-label="Sections" className="flex flex-col gap-0.5">
            <CategoryNav categories={CATEGORIES[GAME]} value={category ?? null} onNavigate={onNavigate} />
            <NavHeading>Yours</NavHeading>
            <Button type="button" variant="ghost" disabled className={NAV_ITEM_CLASS}>
                Watchlist <Soon />
            </Button>
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

/** The same navigation as a drawer, for phones. It also holds the league and unit controls the header hides there. */
export function SidebarDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const { scope, leagueName, setLeague, setUnit } = useEconomyContext();
    const leagues = useLeagues(GAME);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="left" className="overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                    <SheetDescription className="sr-only">Categories and your sections</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-3 px-3 pb-6">
                    <LeagueSwitcher leagues={leagues.data?.leagues ?? []} value={leagueName ?? null} onChange={setLeague} />
                    <UnitToggle value={scope.unit} onChange={setUnit} />
                    <SidebarNav onNavigate={() => onOpenChange(false)} />
                </div>
            </SheetContent>
        </Sheet>
    );
}
