import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCreateInvite, useInvites, useRevokeInvite } from '@/lib/api/auth';
import { LinkNotice } from './LinkNotice';

export function InvitesPanel() {
    const invites = useInvites();
    const create = useCreateInvite();
    const revoke = useRevokeInvite();

    return (
        <Card>
            <CardHeader>
                <CardTitle role="heading" aria-level={2}>
                    Invites
                </CardTitle>
                <CardDescription>Each link creates one account and expires after 7 days.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                <div className="flex gap-2">
                    <Button size="sm" disabled={create.isPending} onClick={() => create.mutate('member')}>
                        Invite a friend
                    </Button>
                    <Button size="sm" variant="outline" disabled={create.isPending} onClick={() => create.mutate('admin')}>
                        Invite an admin
                    </Button>
                </div>

                {create.data && (
                    <LinkNotice title="Invite link" path={'/invite/' + create.data.token} expiresAt={create.data.invite.expiresAt} onDismiss={create.reset} />
                )}

                {(create.isError || revoke.isError) && (
                    <p role="alert" className="text-destructive text-sm">
                        That didn't work. Try again.
                    </p>
                )}

                {invites.isPending && <Skeleton className="h-16 w-full" aria-busy="true" aria-label="Loading invites" />}

                {invites.isError && (
                    <div className="flex items-center gap-3" role="alert">
                        <p className="text-sm">Can't load the invites.</p>
                        <Button variant="outline" size="sm" onClick={() => void invites.refetch()}>
                            Try again
                        </Button>
                    </div>
                )}

                {invites.data?.invites.length === 0 && <p className="text-muted-foreground text-sm">No open invites.</p>}

                <ul className="divide-y">
                    {invites.data?.invites.map((invite) => (
                        <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                            <span className="text-sm">
                                <span className="font-medium">{invite.role === 'admin' ? 'Admin' : 'Friend'}</span>
                                <span className="text-muted-foreground"> · expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
                            </span>
                            <Button size="sm" variant="outline" disabled={revoke.isPending} onClick={() => revoke.mutate(invite.id)}>
                                Revoke
                            </Button>
                        </li>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
}
