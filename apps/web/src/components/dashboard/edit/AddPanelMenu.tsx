import type { PanelTemplate } from '@poelens/shared';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

/** "Add panel": the ready-made panels, each with a line on what it holds. Without them (still loading, or failed) a blank panel is still offered. */
export function AddPanelMenu({
    templates,
    disabled,
    onAdd,
}: {
    templates: readonly PanelTemplate[] | undefined;
    disabled: boolean;
    onAdd: (template: PanelTemplate | undefined) => void;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" disabled={disabled} className="gap-2">
                    <Plus aria-hidden="true" className="text-primary" />
                    Add panel
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">Start from</DropdownMenuLabel>
                {!templates?.length && <DropdownMenuItem onSelect={() => onAdd(undefined)}>Blank panel</DropdownMenuItem>}
                {templates?.map((template) => (
                    <DropdownMenuItem key={template.id} onSelect={() => onAdd(template)} className="flex-col items-start gap-0.5">
                        <span className="font-semibold">{template.name}</span>
                        <span className="text-muted-foreground text-xs">{template.description}</span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
