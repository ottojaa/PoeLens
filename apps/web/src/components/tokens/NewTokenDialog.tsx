import { MAX_API_TOKENS, type CreateApiTokenResponse } from '@poelens/shared';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Field } from '@/components/auth/Field';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { createApiToken, toMcpUrl, useRefreshApiTokens } from '@/lib/api/api-tokens';
import { toFormError } from '@/lib/api/error-message';
import { toClaudeCodeCommand, toDesktopConfig } from '@/lib/tokens/snippets';
import { CopyBlock } from './CopyBlock';

/** The two states of the dialog: asking for a name, then showing the secret once. It lives only as long as the dialog is open. */
function NewTokenForm({ onClose }: { onClose: () => void }) {
    const [created, setCreated] = useState<CreateApiTokenResponse | null>(null);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const refresh = useRefreshApiTokens();

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const name = String(new FormData(event.currentTarget).get('name') ?? '').trim();

        setPending(true);
        setError(null);

        try {
            setCreated(await createApiToken(name));
            void refresh();
        } catch (failure) {
            setError(toFormError(failure));
        } finally {
            setPending(false);
        }
    }

    if (created) return <SecretView created={created} onClose={onClose} />;

    return (
        <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
            <DialogHeader>
                <DialogTitle>New token</DialogTitle>
                <DialogDescription>Name it after where you will use it, so you can tell your tokens apart later.</DialogDescription>
            </DialogHeader>
            <Field id="token-name" name="name" label="Name" placeholder="Claude Code on my laptop" maxLength={60} required autoFocus autoComplete="off" />
            {error && (
                <p role="alert" className="text-destructive text-sm">
                    {error}
                </p>
            )}
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={onClose}>
                    Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                    {pending ? 'Creating…' : 'Create token'}
                </Button>
            </DialogFooter>
        </form>
    );
}

function SecretView({ created, onClose }: { created: CreateApiTokenResponse; onClose: () => void }) {
    const url = toMcpUrl();

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <DialogHeader>
                <DialogTitle>Token “{created.token.name}” created</DialogTitle>
                <DialogDescription>Copy it now. It is not shown again: if you lose it, revoke it and make a new one.</DialogDescription>
            </DialogHeader>
            <CopyBlock label="Your token" text={created.secret} copyLabel="Copy token" />
            <p role="note" className="border-destructive/40 text-destructive rounded-md border px-3 py-2 text-sm">
                Anyone with this token can read your prices and change your watchlist as you. Keep it out of screenshots and shared files.
            </p>
            <CopyBlock label="Claude Code" text={toClaudeCodeCommand(url, created.secret)} />
            <CopyBlock
                label="Claude Desktop (claude_desktop_config.json, needs Node.js; the mcp-remote version is pinned on purpose)"
                text={toDesktopConfig(url, created.secret)}
            />
            <DialogFooter>
                <Button type="button" onClick={onClose}>
                    I have copied it
                </Button>
            </DialogFooter>
        </div>
    );
}

/** The "New token" button and its dialog. At the cap the button is disabled and the page says why. */
export function NewTokenDialog({ count, describedBy }: { count: number; describedBy?: string }) {
    const [open, setOpen] = useState(false);
    const isFull = count >= MAX_API_TOKENS;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button disabled={isFull} aria-describedby={isFull ? describedBy : undefined}>
                    <Plus />
                    New token
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto" onInteractOutside={(event) => event.preventDefault()}>
                <NewTokenForm onClose={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}
