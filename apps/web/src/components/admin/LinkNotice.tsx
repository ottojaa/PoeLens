import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface LinkNoticeProps {
    title: string;
    /** The path after the origin, such as `/invite/<token>`. */
    path: string;
    expiresAt: string;
    onDismiss: () => void;
}

/** Shows a freshly created link once: the server keeps only a hash of its token, so it cannot be shown again. */
export function LinkNotice({ title, path, expiresAt, onDismiss }: LinkNoticeProps) {
    const [copied, setCopied] = useState(false);
    // Built here, not by the API: the link points at whichever origin the admin is using.
    const link = window.location.origin + path;

    async function copy() {
        await navigator.clipboard.writeText(link);
        setCopied(true);
    }

    return (
        <Card role="status" className="border-primary/40">
            <CardHeader>
                <CardTitle role="heading" aria-level={3}>
                    {title}
                </CardTitle>
                <CardDescription>Send it yourself. It works once, until {new Date(expiresAt).toLocaleDateString()}, and is not shown again.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
                <code className="bg-muted rounded-md px-3 py-2 text-sm break-all">{link}</code>
                <div className="flex gap-2">
                    <Button size="sm" onClick={() => void copy()}>
                        {copied ? <Check /> : <Copy />}
                        {copied ? 'Copied' : 'Copy link'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={onDismiss}>
                        Dismiss
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
