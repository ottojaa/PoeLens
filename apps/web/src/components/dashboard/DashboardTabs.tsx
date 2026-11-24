import type { Dashboard } from '@poelens/shared';
import { MoreHorizontal, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { SortableList, useSortableItem } from './dnd';

interface TabProps {
    dashboard: Dashboard;
    index: number;
    active: boolean;
    locked: boolean;
    onSelect: () => void;
    /** Set where the tab has a neighbour on that side: the keyboard's way of reordering. */
    onMoveLeft?: () => void;
    onMoveRight?: () => void;
    onRename: () => void;
    onDelete: () => void;
}

function Tab({ dashboard, index, active, locked, onSelect, onMoveLeft, onMoveRight, onRename, onDelete }: TabProps) {
    const { ref, handleRef } = useSortableItem(dashboard.id, index, { keyboard: false });

    return (
        <div ref={ref} className="flex shrink-0 items-center">
            <Button
                ref={handleRef}
                type="button"
                role="tab"
                variant="ghost"
                aria-selected={active}
                disabled={locked && !active}
                onClick={onSelect}
                className={cn(
                    '-mb-px h-11 rounded-none border-b-2 px-3.5 text-[15px] hover:bg-transparent',
                    active ? 'border-primary text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground border-transparent font-medium',
                )}
            >
                {dashboard.name}
            </Button>
            {active && !locked && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground -ml-2 size-7"
                            aria-label={'Options for ' + dashboard.name}
                        >
                            <MoreHorizontal aria-hidden="true" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
                        <DropdownMenuItem disabled={!onMoveLeft} onSelect={onMoveLeft}>
                            Move left
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={!onMoveRight} onSelect={onMoveRight}>
                            Move right
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    );
}

function toSwapped(ids: readonly string[], from: number, to: number): string[] {
    const next = [...ids];
    const [moved] = next.splice(from, 1);

    if (moved !== undefined) next.splice(to, 0, moved);

    return next;
}

/**
 * The dashboards of the signed-in user as tabs: click to switch, drag or the tab's menu to reorder, "+" to add one. While one is edited
 * the other tabs are locked, so a half-edited draft can't be left behind.
 */
export function DashboardTabs({
    dashboards,
    activeId,
    locked,
    canAdd,
    onSelect,
    onAdd,
    onReorder,
    onRename,
    onDelete,
}: {
    dashboards: readonly Dashboard[];
    activeId: string;
    locked: boolean;
    canAdd: boolean;
    onSelect: (id: string) => void;
    onAdd: () => void;
    onReorder: (ids: string[]) => void;
    onRename: (dashboard: Dashboard) => void;
    onDelete: (dashboard: Dashboard) => void;
}) {
    const ids = dashboards.map((dashboard) => dashboard.id);

    return (
        <div className="flex min-w-0 flex-1 items-end">
            <SortableList ids={ids} onReorder={onReorder}>
                <div
                    role="tablist"
                    aria-label="Your dashboards"
                    className="flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-w-0 items-end gap-0.5 overflow-x-auto"
                >
                    {dashboards.map((dashboard, index) => (
                        <Tab
                            key={dashboard.id}
                            dashboard={dashboard}
                            index={index}
                            active={dashboard.id === activeId}
                            locked={locked}
                            onSelect={() => onSelect(dashboard.id)}
                            onMoveLeft={index > 0 ? () => onReorder(toSwapped(ids, index, index - 1)) : undefined}
                            onMoveRight={index < ids.length - 1 ? () => onReorder(toSwapped(ids, index, index + 1)) : undefined}
                            onRename={() => onRename(dashboard)}
                            onDelete={() => onDelete(dashboard)}
                        />
                    ))}
                </div>
            </SortableList>
            <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="New dashboard"
                title={canAdd ? 'New dashboard' : 'You have as many dashboards as fit'}
                disabled={locked || !canAdd}
                onClick={onAdd}
                className="mr-1 mb-1 ml-1.5 size-9 shrink-0"
            >
                <Plus aria-hidden="true" />
            </Button>
        </div>
    );
}
