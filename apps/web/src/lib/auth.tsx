import type { RegisterRequest, User } from '@poelens/shared';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchCurrentUser, postLogin, postLogout, postRegister } from './api/auth';
import { expireSession, onSessionExpired, refreshSession, setAccessToken } from './api/session';

export type AuthState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: User };

interface AuthContextValue {
    state: AuthState;
    signIn: (email: string, password: string) => Promise<void>;
    register: (input: RegisterRequest) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Restores the session from the refresh cookie when the page loads. */
async function restoreSession(): Promise<User | null> {
    if (!(await refreshSession())) return null;

    return (await fetchCurrentUser()).user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const [state, setState] = useState<AuthState>({ status: 'loading' });

    useEffect(() => {
        let cancelled = false;

        restoreSession()
            .then((user) => !cancelled && setState(user ? { status: 'signedIn', user } : { status: 'signedOut' }))
            .catch(() => !cancelled && setState({ status: 'signedOut' }));

        return () => {
            cancelled = true;
        };
    }, []);

    // A request that could not renew the session ends it. Cached answers belong to the user who is gone.
    useEffect(
        () =>
            onSessionExpired(() => {
                queryClient.clear();
                setState({ status: 'signedOut' });
            }),
        [queryClient],
    );

    const startSession = useCallback(
        (session: { user: User; accessToken: string }) => {
            queryClient.clear();
            setAccessToken(session.accessToken);
            setState({ status: 'signedIn', user: session.user });
        },
        [queryClient],
    );

    const value = useMemo<AuthContextValue>(
        () => ({
            state,
            signIn: async (email, password) => startSession(await postLogin(email, password)),
            register: async (input) => startSession(await postRegister(input)),
            signOut: async () => {
                // Even if the request fails, this device forgets the session; the cookie only matters to the server.
                await postLogout().catch(() => undefined);
                expireSession();
            },
        }),
        [state, startSession],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const value = useContext(AuthContext);

    if (!value) throw new Error('useAuth needs an AuthProvider');

    return value;
}
