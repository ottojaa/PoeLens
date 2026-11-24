import type { PriceRow } from '@poelens/shared';
import type { ReactNode } from 'react';
import { ItemIcon } from '@/components/economy/ItemIcon';
import { formatPrice } from '@/lib/format';
import { ItemLink } from './DataRow';
import { UnitMark } from './UnitMark';

/**
 * One item of a movers or screener list: icon, name, its price with an optional note after it, and what moved on the
 * right (the change, and under it an optional caption).
 */
export function RankedRow({ row, note, children }: { row: PriceRow; note?: string; children: ReactNode }) {
    return (
        <ItemLink item={row.item} className="flex min-h-10 items-center gap-2.5">
            <ItemIcon item={row.item} size="xs" />
            <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="line-clamp-2 text-[13px] leading-tight font-semibold">{row.item.name}</span>
                <span className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                    {formatPrice(row.price)}
                    <UnitMark unit={row.unit} />
                    {note && <span className="truncate">{note}</span>}
                </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-px">{children}</span>
        </ItemLink>
    );
}
