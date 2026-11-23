import type { User } from '@poelens/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useIssueResetLink, useSetUserActive, useUsers } from '@/lib/api/auth';
import { useAuth } from '@/lib/auth';
import { LinkNotice } from './LinkNotice';

export function UsersPanel() {
    const { state } = useAuth();
    const users = useUsers();
    const setActive = useSetUserActive();
    const issueReset = useIssueResetLink();
    const selfId = state.status === 'signedIn' ? state.user.id : null;

    return (
        <Card>
            <CardHeader>
                <CardTitle role="heading" aria-level={2}>
                    People
                </CardTitle>
                <CardDescription>
                    Deactivating someone signs them out everywhere within 15 minutes. A reset link lets them choose a new password.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {issueReset.data && (
                    <LinkNotice
                        title="Reset link"
                        path={'/reset/' + issueReset.data.token}
                        expiresAt={issueReset.data.expiresAt}
                        onDismiss={issueReset.reset}
                    />
                )}

                {users.isPending && <Skeleton className="h-24 w-full" aria-busy="true" aria-label="Loading people" />}

                {users.isError && (
                    <div className="flex items-center gap-3" role="alert">
                        <p className="text-sm">Can't load the people.</p>
                        <Button variant="outline" size="sm" onClick={() => void users.refetch()}>
                            Try again
                        </Button>
                    </div>
                )}

                {(setActive.isError || issueReset.isError) && (
                    <p role="alert" className="text-destructive text-sm">
                        That didn't work. Try again.
                    </p>
                )}

                <ul className="divide-y">
                    {users.data?.users.map((user) => (
                        <UserRow
                            key={user.id}
                            user={user}
                            isSelf={user.id === selfId}
                            busy={setActive.isPending || issueReset.isPending}
                            onToggle={() => setActive.mutate({ id: user.id, active: !user.isActive })}
                            onReset={() => issueReset.mutate(user.id)}
                        />
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}

interface UserRowProps {
    user: User;
    isSelf: boolean;
    busy: boolean;
    onToggle: () => void;
    onReset: () => void;
}

function UserRow({ user, isSelf, busy, onToggle, onReset }: UserRowProps) {
    return (
        <li className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-2 font-medium">
                    <span className="truncate">{user.displayName}</span>
                    <Badge variant="outline">{user.role}</Badge>
                    {!user.isActive && <Badge variant="outline">deactivated</Badge>}
                </span>
                <span className="text-muted-foreground truncate text-sm">{user.email}</span>
            </div>
            <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={onReset}>
                    Reset link
                </Button>
                {/* An admin cannot deactivate themselves: the only admin would lock everyone out. */}
                <Button size="sm" variant="outline" disabled={busy || isSelf} onClick={onToggle}>
                    {user.isActive ? 'Deactivate' : 'Reactivate'}
                </Button>
            </div>
        </li>
    );
}
