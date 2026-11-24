import { KeyRound } from 'lucide-react';

/** What /tokens says before the first token: what one is for, and how to start. */
export function EmptyTokens() {
    return (
        <div role="status" className="bg-card flex flex-col items-center gap-2 rounded-xl border px-6 py-14 text-center">
            <span className="text-muted-foreground">
                <KeyRound aria-hidden="true" />
            </span>
            <p className="font-semibold">You have no tokens yet.</p>
            <p className="text-muted-foreground max-w-md text-sm">
                Make one with “New token”, then paste the command it shows into Claude Code, or the config into Claude Desktop. Claude can then answer price
                questions and keep your watchlist.
            </p>
        </div>
    );
}
