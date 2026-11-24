import type { PairBlock, PairBlockData } from '@poelens/shared';
import { Change } from '@/components/economy/Change';
import { ItemIcon } from '@/components/economy/ItemIcon';
import { Sparkline } from '@/components/economy/Sparkline';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/format';
import { toPairName } from './block-format';
import { BlockMessage, ItemLink } from './DataRow';

/** `[A] = [B]`, with the amounts below the icons: "1" under A, what one A buys under B. */
function Figure({ data }: { data: PairBlockData }) {
    return (
        <span className="grid shrink-0 grid-cols-[auto_auto_auto] items-center justify-items-center gap-x-1.5 gap-y-0.5">
            <ItemIcon item={data.a} size="xs" />
            <span aria-hidden="true" className="text-muted-foreground text-sm">
                =
            </span>
            <ItemIcon item={data.b} size="xs" />
            <span className="text-muted-foreground text-xs font-semibold">1</span>
            <span />
            <span className="text-xs font-semibold whitespace-nowrap">{data.price === null ? '—' : formatPrice(data.price)}</span>
        </span>
    );
}

/** One item priced in another: how many B one A buys, with its 24 hour change and, in a wide panel, a week's trend. */
export function PairBlockView({ block, data }: { block: PairBlock; data: PairBlockData | null | undefined }) {
    if (data === undefined) return <BlockMessage>Loading…</BlockMessage>;

    if (data === null) return <BlockMessage>{toPairName(block, data)}: no price in this league</BlockMessage>;

    return (
        <ItemLink item={data.a} className="flex items-center gap-3">
            <Figure data={data} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-muted-foreground truncate text-[13px]">{toPairName(block, data)}</span>
                {data.lowConfidence && (
                    <Badge variant="outline" className="text-warning border-warning/50 w-fit" title="Few listings or little trading: the rate may be unreliable">
                        low
                    </Badge>
                )}
            </span>
            <span className="hidden shrink-0 @min-[320px]:block">
                <Sparkline points={data.sparkline} change={data.h24} width={64} height={24} />
            </span>
            <Change percent={data.h24} className="min-w-[58px] shrink-0 text-right text-[13px]" />
        </ItemLink>
    );
}
