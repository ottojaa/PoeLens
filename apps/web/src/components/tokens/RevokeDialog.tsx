import type { ApiToken } from '@poelens/shared';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useRevokeApiToken } from '@/lib/api/api-tokens';

/** The Revoke button of one token, behind a confirmation: whatever uses the token stops working at once. */
export function RevokeDialog({ token }: { token: ApiToken }) {
    const [open, setOpen] = useState(false);
    const revoke = useRevokeApiToken();

    function confirm() {
        revoke.mutate(token.id, { onSuccess: () => setOpen(false) });
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                revoke.reset();
            }}
        >
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" aria-label={`Revoke ${token.name}`}>
                    Revoke
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Revoke “{token.name}”?</DialogTitle>
                    <DialogDescription>
                        Anything using this token (Claude Code or Desktop on whichever machine has it) stops working on its next request. This cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                {revoke.isError && (
                    <p role="alert" className="text-destructive text-sm">
                        That didn't work. Try again.
                    </p>
                )}
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                        Keep it
                    </Button>
                    <Button type="button" variant="destructive" disabled={revoke.isPending} onClick={confirm}>
                        {revoke.isPending ? 'Revoking…' : 'Revoke token'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
