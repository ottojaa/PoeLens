import { PreferencesSchema, type Preferences } from '@poelens/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { fetchApi } from './client';

const PREFERENCES_KEY = ['me', 'preferences'] as const;
const SAVE_KEY = ['me', 'preferences', 'save'] as const;
const ERROR_TOAST_ID = 'preferences-error';

/** What the signed-in user saved; undefined while signed out or until the first answer. */
export function useAccountPreferences(): Preferences | undefined {
    const { state } = useAuth();

    return useQuery({
        queryKey: PREFERENCES_KEY,
        queryFn: () => fetchApi('/me/preferences', PreferencesSchema),
        enabled: state.status === 'signedIn',
        // Other devices change these, so look again when the user comes back to the tab. The answer is tiny.
        staleTime: 60 * 1000,
    }).data;
}

/**
 * Saves a partial update to the signed-in user's preferences. The cached answer changes at once, so the screen follows
 * the click, and a failure puts the server's answer back. Updates are sent one at a time and in order.
 */
export function useSavePreferences(): (patch: Preferences) => void {
    const queryClient = useQueryClient();
    const { mutate } = useMutation({
        mutationKey: SAVE_KEY,
        scope: { id: 'preferences' },
        mutationFn: (patch: Preferences) => fetchApi('/me/preferences', PreferencesSchema, { method: 'PATCH', json: patch }),
        onMutate: async (patch) => {
            await queryClient.cancelQueries({ queryKey: PREFERENCES_KEY });
            queryClient.setQueryData<Preferences>(PREFERENCES_KEY, (previous) => ({ ...previous, ...patch }));
        },
        onError: () => void toast.error("Couldn't save your preference. It will be back as it was.", { id: ERROR_TOAST_ID }),
        onSettled: (saved) => {
            // This update is still counted while it settles. With more queued behind it, their own optimistic values stand.
            if (queryClient.isMutating({ mutationKey: SAVE_KEY }) > 1) return;

            if (saved) return void queryClient.setQueryData(PREFERENCES_KEY, saved);

            return queryClient.invalidateQueries({ queryKey: PREFERENCES_KEY });
        },
    });

    return mutate;
}
