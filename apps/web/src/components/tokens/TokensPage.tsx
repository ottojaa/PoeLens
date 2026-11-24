import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useApiTokens } from '@/lib/api/api-tokens';
import { EmptyTokens } from './EmptyTokens';
import { NewTokenDialog } from './NewTokenDialog';
import { TokenList } from './TokenList';

const FULL_NOTE_ID = 'tokens-full-note';

/** The signed-in user's API tokens: what they are for, the list, and making and revoking them. */
export function TokensPage() {
    const tokens = useApiTokens();
    const count = tokens.data?.tokens.length ?? 0;
    const max = tokens.data?.max;
    const isFull = max !== undefined && count >= max;

    return (
        <div className="flex max-w-3xl flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="font-heading text-[30px] leading-tight font-bold">MCP &amp; API tokens</h1>
                    <p className="text-muted-foreground mt-1 max-w-xl text-sm">
                        A token lets Claude Code or Claude Desktop read PoeLens prices and read and change your watchlist, as you. It works only with PoeLens's
                        MCP server, and you can revoke it at any time.
                    </p>
                </div>
                {tokens.data && <NewTokenDialog count={count} describedBy={FULL_NOTE_ID} />}
            </div>
            {isFull && (
                <p id={FULL_NOTE_ID} role="status" className="text-muted-foreground text-sm">
                    You have {count} of {max} tokens. Revoke one to make a new one.
                </p>
            )}
            {tokens.isPending && <Skeleton className="h-28 w-full rounded-xl" aria-busy="true" aria-label="Loading your tokens" />}
            {tokens.isError && (
                <div className="flex items-center gap-3" role="alert">
                    <p className="text-sm">Can't load your tokens.</p>
                    <Button variant="outline" size="sm" onClick={() => void tokens.refetch()}>
                        Try again
                    </Button>
                </div>
            )}
            {tokens.data && (tokens.data.tokens.length === 0 ? <EmptyTokens /> : <TokenList tokens={tokens.data.tokens} />)}
        </div>
    );
}
