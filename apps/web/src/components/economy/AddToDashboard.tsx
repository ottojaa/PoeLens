import { MAX_BLOCKS, type Block } from '@poelens/shared';
import { LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppendBlock, useDashboards } from '@/lib/api/dashboards';
import { GAME } from '@/lib/economy/use-economy-context';

/**
 * "Add to dashboard": puts the block it is given on one of the user's dashboards, in a new panel or one it already has.
 * It adds to the stored dashboard, so a dashboard being edited in another tab is not overwritten.
 */
export function AddToDashboard({ block, title }: { block: Block; title: string }) {
    const dashboards = useDashboards(GAME);
    const append = useAppendBlock(GAME);
    const list = dashboards.data?.dashboards ?? [];

    const add = (dashboardId: string, dashboardName: string, panelId: string | undefined) =>
        append.mutate(
            { dashboardId, block, panelId, title },
            {
                onSuccess: () => toast.success('Added to ' + dashboardName),
                onError: () => toast.error('Could not add it to ' + dashboardName + '. Try again.'),
            },
        );

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" className="gap-2" disabled={dashboards.isPending || append.isPending}>
                    <LayoutDashboard aria-hidden="true" />
                    Add to dashboard
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">
                    Add as a price table to
                </DropdownMenuLabel>
                {dashboards.isError && <DropdownMenuItem disabled>Dashboards did not load</DropdownMenuItem>}
                {list.map((dashboard) => (
                    <DropdownMenuSub key={dashboard.id}>
                        <DropdownMenuSubTrigger>{dashboard.name}</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="max-h-72 w-60 overflow-y-auto">
                            <DropdownMenuItem onSelect={() => add(dashboard.id, dashboard.name, undefined)}>New panel</DropdownMenuItem>
                            {dashboard.panels.length > 0 && <DropdownMenuSeparator />}
                            {dashboard.panels.map((panel) => (
                                <DropdownMenuItem
                                    key={panel.id}
                                    disabled={panel.blocks.length >= MAX_BLOCKS}
                                    onSelect={() => add(dashboard.id, dashboard.name, panel.id)}
                                >
                                    <span className="truncate">{panel.title}</span>
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuSubContent>
                    </DropdownMenuSub>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
