import {
    CreateInviteResponseSchema,
    CurrentUserResponseSchema,
    InvitePreviewSchema,
    InvitesResponseSchema,
    LogoutResponseSchema,
    ResetLinkResponseSchema,
    SessionResponseSchema,
    UserSchema,
    UsersResponseSchema,
    type RegisterRequest,
    type Role,
} from '@poelens/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi, sendApi } from './client';

const LINK_PAGE: { skipRefresh: true } = { skipRefresh: true };

export function fetchCurrentUser() {
    return fetchApi('/auth/me', CurrentUserResponseSchema);
}

export function postLogin(email: string, password: string) {
    return fetchApi('/auth/login', SessionResponseSchema, { method: 'POST', json: { email, password }, ...LINK_PAGE });
}

export function postRegister(input: RegisterRequest) {
    return fetchApi('/auth/register', SessionResponseSchema, { method: 'POST', json: input, ...LINK_PAGE });
}

export function postReset(token: string, password: string) {
    return fetchApi('/auth/reset', LogoutResponseSchema, { method: 'POST', json: { token, password }, ...LINK_PAGE });
}

export function postLogout() {
    return fetchApi('/auth/logout', LogoutResponseSchema, { method: 'POST', ...LINK_PAGE });
}

export function useInvitePreview(token: string) {
    return useQuery({
        queryKey: ['invite-preview', token],
        queryFn: () => fetchApi('/auth/invites/' + encodeURIComponent(token), InvitePreviewSchema, LINK_PAGE),
        retry: false,
    });
}

const USERS_KEY = ['admin', 'users'];
const INVITES_KEY = ['admin', 'invites'];

export function useUsers() {
    return useQuery({ queryKey: USERS_KEY, queryFn: () => fetchApi('/admin/users', UsersResponseSchema), staleTime: 0 });
}

export function useInvites() {
    return useQuery({ queryKey: INVITES_KEY, queryFn: () => fetchApi('/admin/invites', InvitesResponseSchema), staleTime: 0 });
}

export function useSetUserActive() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, active }: { id: string; active: boolean }) =>
            fetchApi(`/admin/users/${id}/${active ? 'reactivate' : 'deactivate'}`, UserSchema, { method: 'POST' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
    });
}

export function useIssueResetLink() {
    return useMutation({
        mutationFn: (id: string) => fetchApi(`/admin/users/${id}/reset-link`, ResetLinkResponseSchema, { method: 'POST' }),
    });
}

export function useCreateInvite() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (role: Role) => fetchApi('/admin/invites', CreateInviteResponseSchema, { method: 'POST', json: { role } }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITES_KEY }),
    });
}

export function useRevokeInvite() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => sendApi('/admin/invites/' + id, { method: 'DELETE' }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: INVITES_KEY }),
    });
}
