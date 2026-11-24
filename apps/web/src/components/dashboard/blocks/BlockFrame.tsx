import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** The shared spacing and divider of every block: a rule above each block, except after a heading and at the top. */
export function BlockFrame({
    ruled,
    heading,
    outline,
    children,
}: {
    ruled: boolean;
    heading?: boolean;
    /** While one block's settings are open: that block is `open`, its siblings `idle`. */
    outline?: 'open' | 'idle';
    children: ReactNode;
}) {
    return (
        <div
            className={cn(
                'relative px-3',
                heading ? 'pt-3 pb-1' : 'py-2.5',
                ruled && 'border-border border-t',
                outline && '-outline-offset-2 rounded-lg outline',
                outline === 'open' && 'outline-primary outline-2',
                outline === 'idle' && 'outline-input outline-1 outline-dashed',
            )}
        >
            {children}
        </div>
    );
}
