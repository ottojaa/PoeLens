import type { ItemRef } from '@poelens/shared';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const ROW_CLASS =
    'hover:bg-accent focus-visible:ring-ring/50 -mx-2 -my-1 rounded-lg px-2 py-1 outline-none transition-colors duration-150 focus-visible:ring-[3px]';

/** A row of a block that opens the item it is about. */
export function ItemLink({ item, className, children }: { item: Pick<ItemRef, 'id'>; className?: string; children: ReactNode }) {
    return (
        <Link to="/items/$itemId" params={{ itemId: String(item.id) }} className={cn(ROW_CLASS, className)}>
            {children}
        </Link>
    );
}

/** What a block shows while its price is on its way, or when it has none. */
export function BlockMessage({ children }: { children: ReactNode }) {
    return <p className="text-muted-foreground text-[13px]">{children}</p>;
}

/** The small line above a block that names what it shows ("Movers · all uniques · 24 h"). */
export function BlockTitle({ children }: { children: ReactNode }) {
    return <p className="text-muted-foreground mb-1.5 truncate text-xs font-semibold">{children}</p>;
}
