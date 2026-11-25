import type { PanelTemplate } from '@poelens/shared';
import { LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { AddPanelMenu } from './AddPanelMenu';

export type EditLevel = 'layout' | 'content';

/** The bar across the top while a dashboard is edited: what is edited, the level, adding a panel, and Cancel / Done. */
export function EditBar({
    name,
    level,
    contentTitle,
    canLayout,
    hint,
    canAddPanel,
    templates,
    saving,
    onLevel,
    onAddPanel,
    onCancel,
    onDone,
}: {
    name: string;
    level: EditLevel;
    /** The title of the panel whose content is open, for the Content segment. */
    contentTitle: string | undefined;
    /** Panels are placed on a grid, which a phone does not draw. */
    canLayout: boolean;
    /** Replaces the usual line of help, e.g. when the window has been narrowed while editing. */
    hint?: string;
    canAddPanel: boolean;
    templates: readonly PanelTemplate[] | undefined;
    saving: boolean;
    onLevel: (level: EditLevel) => void;
    onAddPanel: (template: PanelTemplate | undefined) => void;
    onCancel: () => void;
    onDone: () => void;
}) {
    return (
        <div className="bg-popover border-input flex flex-wrap items-center gap-x-3.5 gap-y-2 border-b px-4 py-2.5 md:px-6">
            <span className="flex items-center gap-2 text-sm font-semibold">
                <LayoutDashboard aria-hidden="true" className="text-primary size-4" />
                Editing {name}
            </span>
            {canLayout && (
                <Segmented
                    label="What you're editing"
                    value={level}
                    onChange={onLevel}
                    className="bg-card"
                    options={[
                        { value: 'layout', label: 'Layout' },
                        { value: 'content', label: contentTitle ? 'Content · ' + contentTitle : 'Content' },
                    ]}
                />
            )}
            <span className={hint ? 'text-muted-foreground text-[13px]' : 'text-muted-foreground hidden text-[13px] xl:inline'}>
                {hint ??
                    (level === 'content'
                        ? 'Reorder, add and set up the blocks in this panel.'
                        : 'Drag a panel by its top bar, resize it from the corner, or open its content.')}
            </span>
            <div className="ml-auto flex items-center gap-2">
                <AddPanelMenu templates={templates} disabled={!canAddPanel} onAdd={onAddPanel} />
                <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
                    Cancel
                </Button>
                <Button type="button" onClick={onDone} disabled={saving}>
                    {saving ? 'Saving…' : 'Done'}
                </Button>
            </div>
        </div>
    );
}
