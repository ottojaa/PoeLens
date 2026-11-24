import type { Dashboard } from '@poelens/shared';
import { useReducer, useState } from 'react';
import { toast } from 'sonner';
import { toCurrentDashboard, useSaveDashboard } from '@/lib/api/dashboards';
import { draftReducer, isDirty, toDraft } from '@/lib/dashboard/editor';
import { GAME } from '@/lib/economy/use-economy-context';
import type { EditLevel } from './edit/EditBar';

interface EditState {
    level: EditLevel;
    /** The panel whose content is open (Content level), or the one last opened. */
    panelId: string | undefined;
}

/**
 * Editing one dashboard: a draft that every change goes into, and Done, which saves it. A save refused because another
 * tab saved first leaves the draft in place and hands back the stored dashboard, so the user can reload or overwrite.
 */
export function useDashboardEditing(active: Dashboard, reload: () => void) {
    const save = useSaveDashboard(GAME);
    const [edit, setEdit] = useState<EditState | null>(null);
    const [draft, dispatch] = useReducer(draftReducer, active, toDraft);
    const [conflict, setConflict] = useState<Dashboard | undefined>(undefined);

    const begin = (panelId?: string) => {
        dispatch({ type: 'reset', draft: toDraft(active) });
        setEdit({ level: panelId ? 'content' : 'layout', panelId });
    };
    const send = (revision: number) =>
        save.mutate(
            { id: active.id, revision, name: draft.name, panels: draft.panels },
            {
                onSuccess: () => {
                    setConflict(undefined);
                    setEdit(null);
                },
                onError: (error) => {
                    const current = toCurrentDashboard(error);

                    if (current) return setConflict(current);

                    toast.error('Could not save the dashboard. Your changes are still here.');
                },
            },
        );

    return {
        edit,
        draft,
        dispatch,
        saving: save.isPending,
        conflict,
        begin,
        setLevel: (level: EditLevel) => setEdit((previous) => previous && { ...previous, level }),
        openContent: (panelId: string) => setEdit({ level: 'content', panelId }),
        cancel: () => setEdit(null),
        done: () => (isDirty(draft, active) ? send(active.revision) : setEdit(null)),
        overwrite: () => conflict && send(conflict.revision),
        reloadStored: () => {
            setConflict(undefined);
            setEdit(null);
            reload();
        },
    };
}
