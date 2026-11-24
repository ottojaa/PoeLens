import type { ItemBlock, ItemBlockData } from '@poelens/shared';
import { Change } from '@/components/economy/Change';
import { ItemIcon } from '@/components/economy/ItemIcon';
import { Sparkline } from '@/components/economy/Sparkline';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/format';
import { toItemName } from './block-format';
import { BlockMessage, ItemLink } from './DataRow';
import { UnitMark } from './UnitMark';

function LowConfidence() {
    return (
        <Badge variant="outline" className="text-warning border-warning/50" title="Few listings or little trading: the price may be unreliable">
            low
        </Badge>
    );
}

/** One item: its icon, name and price, with a trend line once the panel is wide enough. `card` stacks a larger price over the line. */
export function ItemBlockView({ block, data }: { block: ItemBlock; data: ItemBlockData | null | undefined }) {
    if (data === undefined) return <BlockMessage>Loading…</BlockMessage>;

    if (data === null || data.row === null) return <BlockMessage>{toItemName(block, data)}: no price in this league</BlockMessage>;

    const { item, row } = data;
    const name = toItemName(block, data);
    const price = (
        <>
            {formatPrice(row.price)}
            <UnitMark unit={row.unit} />
        </>
    );

    if (block.display === 'card') {
        return (
            <ItemLink item={item} className="flex flex-col gap-2">
                <span className="flex items-center gap-2.5">
                    <ItemIcon item={item} size="xs" />
                    <span className="text-muted-foreground min-w-0 flex-1 truncate text-[13px]">{name}</span>
                    {row.lowConfidence && <LowConfidence />}
                    <Change percent={row.change.h24} className="text-[13px]" />
                </span>
                <span className="flex flex-col items-stretch gap-1.5 @min-[320px]:flex-row @min-[320px]:items-end @min-[320px]:justify-between">
                    <span className="flex items-center gap-1.5 text-2xl leading-tight font-bold tracking-tight whitespace-nowrap">{price}</span>
                    <span className="hidden @min-[320px]:block">
                        <Sparkline points={row.sparkline} change={row.change.d7} width={140} height={34} />
                    </span>
                </span>
            </ItemLink>
        );
    }

    return (
        <ItemLink item={item} className="flex items-center gap-2.5">
            <ItemIcon item={item} size="xs" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-muted-foreground truncate text-[13px]">{name}</span>
                <span className="flex items-center gap-1.5 text-[15px] font-semibold whitespace-nowrap">
                    {price}
                    {row.lowConfidence && <LowConfidence />}
                </span>
            </span>
            <span className="hidden shrink-0 @min-[320px]:block">
                <Sparkline points={row.sparkline} change={row.change.d7} width={64} height={24} />
            </span>
            <Change percent={row.change.h24} className="min-w-[58px] shrink-0 text-right text-[13px]" />
        </ItemLink>
    );
}
