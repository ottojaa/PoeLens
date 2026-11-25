import type { MoversBlock, MoversBlockData, PriceRow } from '@poelens/shared';
import { Change } from '@/components/economy/Change';
import { BlockMessage, BlockTitle } from './DataRow';
import { MOVER_CHANGE_KEY, toMoversTitle } from './block-format';
import { RankedRow } from './RankedRow';
import { GAME } from '@/lib/economy/use-economy-context';

function MoverList({ title, rows, block }: { title: string; rows: readonly PriceRow[]; block: MoversBlock }) {
    return (
        <div className="flex min-w-0 flex-col">
            <span className="text-muted-foreground pt-1 pb-0.5 text-[11px] font-semibold tracking-[0.08em] uppercase">{title}</span>
            {rows.length === 0 && <p className="text-muted-foreground py-1 text-[13px]">None in this window</p>}
            {rows.map((row) => (
                <RankedRow key={row.item.id} row={row}>
                    <Change percent={row.change[MOVER_CHANGE_KEY[block.window]]} className="text-[13px]" />
                </RankedRow>
            ))}
        </div>
    );
}

/** The biggest risers and fallers of a group of categories: side by side in a wide panel, stacked in a narrow one. */
export function MoversBlockView({ block, data }: { block: MoversBlock; data: MoversBlockData | null | undefined }) {
    if (data === undefined) return <BlockMessage>Loading…</BlockMessage>;

    const title = toMoversTitle(GAME, block);

    if (data === null) return <BlockMessage>{title}: no prices in this league</BlockMessage>;

    return (
        <div>
            <BlockTitle>{title}</BlockTitle>
            <div className="grid grid-cols-1 gap-x-6 @min-[520px]:grid-cols-2">
                <MoverList title="Risers" rows={data.risers} block={block} />
                <MoverList title="Fallers" rows={data.fallers} block={block} />
            </div>
        </div>
    );
}
