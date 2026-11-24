import { CATEGORIES, DEFAULT_UNIT } from '@poelens/shared';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { LeagueSwitcher } from './LeagueSwitcher';
import { CategoryNav, NAV_ITEM_CLASS, NavHeading } from './CategoryNav';
import { Soon } from './Soon';
import { UnitToggle } from './UnitToggle';

const GAME = 'poe2';
const noop = () => undefined;

/** The category list plus the personal sections. The economy view will replace the placeholders' `disabled`. */
function SidebarNav() {
    return (
        <nav aria-label="Sections" className="flex flex-col gap-0.5">
            <CategoryNav categories={CATEGORIES[GAME]} value={null} onChange={noop} disabled />
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
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="left" className="overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Menu</SheetTitle>
                    <SheetDescription className="sr-only">Categories and your sections</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-3 px-3 pb-6">
                    <LeagueSwitcher leagues={[]} value={null} onChange={noop} disabled />
                    <UnitToggle value={DEFAULT_UNIT[GAME]} onChange={noop} disabled />
                    <SidebarNav />
                </div>
            </SheetContent>
        </Sheet>
    );
}
