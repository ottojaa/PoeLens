import { MAX_DASHBOARDS, type Dashboard, type DashboardsResponse, type Panel } from '@poelens/shared';
import { LayoutDashboard } from 'lucide-react';
import { useState } from 'react';
import { ErrorState } from '@/components/economy/states';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardData, useDashboards, useCreateDashboard, useDeleteDashboard, useReorderDashboards, useSaveDashboard } from '@/lib/api/dashboards';
import { newPanel } from '@/lib/dashboard/editor';
import { GAME, useEconomyContext } from '@/lib/economy/use-economy-context';
import { useMediaQuery } from '@/lib/use-media-query';
import { DashboardGrid } from './DashboardGrid';
import { DashboardTabs } from './DashboardTabs';
import { ConflictDialog } from './edit/ConflictDialog';
import { ContentSheet } from './edit/ContentSheet';
import { EditBar } from './edit/EditBar';
import { DeleteDialog, NameDialog } from './TabDialogs';
import { useDashboardEditing } from './use-dashboard-editing';

type TabDialog = { kind: 'new' } | { kind: 'rename'; dashboard: Dashboard } | { kind: 'delete'; dashboard: Dashboard };

/** The dialogs the tabs open: a name for a new or renamed dashboard, and the confirmation of a delete. */
function TabDialogs({ dialog, dashboards, onSelect, onClose }: { dialog: TabDialog | undefined; dashboards: readonly Dashboard[]; onSelect: (id: string) => void; onClose: () => void }) {
    const create = useCreateDashboard(GAME);
    const save = useSaveDashboard(GAME);
    const remove = useDeleteDashboard(GAME);

    if (!dialog) return null;

    if (dialog.kind === 'delete') {
        const { dashboard } = dialog;

        return (
            <DeleteDialog
                name={dashboard.name}
                pending={remove.isPending}
                onClose={onClose}
                onConfirm={() => remove.mutate(dashboard.id, { onSuccess: () => (onSelect(dashboards.find((other) => other.id !== dashboard.id)?.id ?? ''), onClose()) })}
            />
        );
    }

    if (dialog.kind === 'rename') {
        const { dashboard } = dialog;

        return (
            <NameDialog
                title="Rename dashboard"
                submitLabel="Rename"
                initial={dashboard.name}
                pending={save.isPending}
                error={save.isError ? 'Could not rename it. Try again.' : undefined}
                onClose={onClose}
                onSubmit={(name) => save.mutate({ id: dashboard.id, revision: dashboard.revision, name, panels: dashboard.panels }, { onSuccess: onClose })}
            />
        );
    }

    return (
        <NameDialog
            title="New dashboard"
            submitLabel="Add"
            initial=""
            pending={create.isPending}
            error={create.isError ? 'Could not add it. Try again.' : undefined}
            onClose={onClose}
            onSubmit={(name) =>
                create.mutate(
                    { game: GAME, name },
                    {
                        onSuccess: (created) => {
                            onSelect(created.id);
                            onClose();
                        },
                    },
                )
            }
        />
    );
}

function EmptyDashboard({ onAdd }: { onAdd: () => void }) {
    return (
        <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
            <LayoutDashboard aria-hidden="true" className="size-6" />
            <p className="text-foreground font-semibold">This dashboard is empty</p>
            <p className="text-sm">Panels hold the prices and notes you want in one place.</p>
            <Button type="button" onClick={onAdd}>
                Add a panel
            </Button>
        </div>
    );
}

function Dashboards({ list, reload }: { list: DashboardsResponse; reload: () => void }) {
    const { scope } = useEconomyContext();
    const isWide = useMediaQuery('(min-width: 768px)');
    const reorder = useReorderDashboards(GAME);
    const [activeId, setActiveId] = useState('');
    const [dialog, setDialog] = useState<TabDialog | undefined>(undefined);
    const active = list.dashboards.find((dashboard) => dashboard.id === activeId) ?? list.dashboards[0];

    if (!active) throw new Error('A dashboard list is never empty: the starter fills it');

    return (
        <DashboardView
            key={active.id}
            active={active}
            dashboards={list.dashboards}
            max={list.max}
            scope={scope}
            isWide={isWide}
            dialog={dialog}
            reload={reload}
            onSelect={setActiveId}
            onDialog={setDialog}
            onReorder={(ids) => reorder.mutate(ids)}
        />
    );
}

interface ViewProps {
    active: Dashboard;
    dashboards: readonly Dashboard[];
    max: number;
    scope: ReturnType<typeof useEconomyContext>['scope'];
    isWide: boolean;
    dialog: TabDialog | undefined;
    reload: () => void;
    onSelect: (id: string) => void;
    onDialog: (dialog: TabDialog | undefined) => void;
    onReorder: (ids: string[]) => void;
}

function DashboardView({ active, dashboards, max, scope, isWide, dialog, reload, onSelect, onDialog, onReorder }: ViewProps) {
    const editing = useDashboardEditing(active, reload);
    const { edit, draft, dispatch } = editing;
    const panels: readonly Panel[] = edit ? draft.panels : active.panels;
    const data = useDashboardData(scope, panels).data?.blocks;
    const selected = panels.find((panel) => panel.id === edit?.panelId);
    const level = edit?.level === 'content' && selected ? 'content' : 'layout';
    const mode = !edit ? 'view' : level === 'content' ? 'content' : isWide ? 'layout' : 'view';
    const addPanel = () => {
        const panel = newPanel(draft.panels);

        if (panel) dispatch({ type: 'addPanel', panel });
    };

    return (
        <div className="flex flex-col gap-3.5">
            {edit && (
                <EditBar
                    name={draft.name}
                    level={level}
                    contentTitle={selected?.title}
                    canLayout={isWide}
                    canAddPanel={newPanel(draft.panels) !== undefined}
                    saving={editing.saving}
                    onLevel={(next) => (next === 'content' && !selected ? panels[0] && editing.openContent(panels[0].id) : editing.setLevel(next))}
                    onAddPanel={addPanel}
                    onCancel={editing.cancel}
                    onDone={editing.done}
                />
            )}
            <div className="flex items-end gap-3 border-b">
                <DashboardTabs
                    dashboards={dashboards}
                    activeId={active.id}
                    locked={edit !== null}
                    canAdd={dashboards.length < max && dashboards.length < MAX_DASHBOARDS}
                    onSelect={onSelect}
                    onAdd={() => onDialog({ kind: 'new' })}
                    onReorder={onReorder}
                    onRename={(dashboard) => onDialog({ kind: 'rename', dashboard })}
                    onDelete={(dashboard) => onDialog({ kind: 'delete', dashboard })}
                />
                {!edit && (
                    <Button type="button" variant="outline" className="mb-1.5 gap-2" onClick={() => editing.begin()}>
                        <LayoutDashboard aria-hidden="true" />
                        Edit
                    </Button>
                )}
            </div>
            {panels.length === 0 && !edit && <EmptyDashboard onAdd={() => editing.begin()} />}
            {panels.length > 0 && (
                <DashboardGrid
                    panels={panels}
                    data={data}
                    mode={mode}
                    selectedId={level === 'content' ? selected?.id : undefined}
                    onLayout={(next) => dispatch({ type: 'layout', panels: next })}
                    onEditContent={(panelId) => (edit ? editing.openContent(panelId) : editing.begin(panelId))}
                />
            )}
            {edit && level === 'content' && selected && (
                <ContentSheet
                    panel={selected}
                    data={data ?? {}}
                    scope={scope}
                    onClose={() => editing.setLevel('layout')}
                    onPatchPanel={(patch) => dispatch({ type: 'patchPanel', id: selected.id, patch })}
                    onAddBlock={(block) => dispatch({ type: 'addBlock', panelId: selected.id, block })}
                    onPatchBlock={(blockId, patch) => dispatch({ type: 'patchBlock', panelId: selected.id, blockId, patch })}
                    onRemoveBlock={(blockId) => dispatch({ type: 'removeBlock', panelId: selected.id, blockId })}
                    onMoveBlock={(from, to) => dispatch({ type: 'moveBlock', panelId: selected.id, from, to })}
                    onDeletePanel={() => {
                        dispatch({ type: 'removePanel', id: selected.id });
                        editing.setLevel('layout');
                    }}
                />
            )}
            <ConflictDialog open={editing.conflict !== undefined} saving={editing.saving} onReload={editing.reloadStored} onOverwrite={editing.overwrite} />
            <TabDialogs dialog={dialog} dashboards={dashboards} onSelect={onSelect} onClose={() => onDialog(undefined)} />
        </div>
    );
}

function DashboardSkeleton() {
    return (
        <div className="flex flex-col gap-4" aria-busy="true">
            <Skeleton className="h-11 w-72" />
            <div className="grid gap-4 md:grid-cols-2">
                <Skeleton className="h-80" />
                <Skeleton className="h-80" />
            </div>
        </div>
    );
}

/** The home page: the signed-in user's dashboards as tabs, each a grid of panels that can be edited in place. */
export function DashboardPage() {
    const list = useDashboards(GAME);

    if (list.isError) return <ErrorState title="Could not load your dashboards" message="Your dashboards did not load. Nothing on them has changed." onRetry={() => void list.refetch()} />;

    if (!list.data) return <DashboardSkeleton />;

    return <Dashboards list={list.data} reload={() => void list.refetch()} />;
}
