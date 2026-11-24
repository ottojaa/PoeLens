import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/** A block of text to copy: scrolls sideways on a narrow screen instead of widening the page. */
export function CopyBlock({ label, text, copyLabel = 'Copy' }: { label: string; text: string; copyLabel?: string }) {
    const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

    async function copy() {
        try {
            await navigator.clipboard.writeText(text);
            setState('copied');
        } catch {
            setState('failed');
        }
    }

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{label}</span>
                <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
                    {state === 'copied' ? <Check /> : <Copy />}
                    {state === 'copied' ? 'Copied' : copyLabel}
                </Button>
            </div>
            <pre
                tabIndex={0}
                aria-label={label}
                className="bg-muted overflow-x-auto rounded-md px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre select-all"
            >
                {text}
            </pre>
            {state === 'failed' && (
                <p role="alert" className="text-destructive text-xs">
                    Copying didn't work here. Select the text and copy it yourself.
                </p>
            )}
        </div>
    );
}
