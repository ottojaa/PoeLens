import type { ScreenerBlock, ScreenerBlockData } from '@poelens/shared';
import { Change } from '@/components/economy/Change';
import { Badge } from '@/components/ui/badge';
import { formatAgo, formatLiquidityWithUnit } from '@/lib/format';
import { BlockMessage } from './DataRow';
import { toScreenerRule } from './block-format';
import { RankedRow } from './RankedRow';

/** Items that match a rule: the rule as chips, then each match with its change over the window. */
export function ScreenerBlockView({ block, data }: { block: ScreenerBlock; data: ScreenerBlockData | null | undefined }) {
    if (data === undefined) return <BlockMessage>Loading…</BlockMessage>;

    if (data === null) return <BlockMessage>No prices in this league</BlockMessage>;

    const checked = data.rows[0]?.asOf;

    return (
        <div>
            <ul aria-label="Rule" className="mb-1.5 flex flex-wrap gap-1.5">
                {toScreenerRule(block).map((chip) => (
                    <li key={chip}>
                        <Badge variant="outline" className="text-muted-foreground bg-background h-6 rounded-full px-2.5 text-xs font-medium">
                            {chip}
                        </Badge>
                    </li>
                ))}
            </ul>
            {data.rows.length === 0 && <BlockMessage>Nothing matches right now</BlockMessage>}
            {data.rows.map((row) => (
                <RankedRow key={row.item.id} row={row} note={row.liquidity ? '· ' + formatLiquidityWithUnit(row.liquidity) : undefined}>
                    <Change percent={row.windowChange} className="text-[13px]" />
                    <span className="text-muted-foreground text-[11px]">in {block.windowHours} h</span>
                </RankedRow>
            ))}
            {checked && <span className="text-muted-foreground mt-1 block text-xs">Checked {formatAgo(checked)}</span>}
        </div>
    );
}
