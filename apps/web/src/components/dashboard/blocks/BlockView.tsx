import type { Block, BlockData } from '@poelens/shared';
import { BlockFrame } from './BlockFrame';
import { ChartBlockView } from './ChartBlockView';
import { HeadingBlockView } from './HeadingBlockView';
import { ItemBlockView } from './ItemBlockView';
import { MoversBlockView } from './MoversBlockView';
import { NoteBlockView } from './NoteBlockView';
import { PairBlockView } from './PairBlockView';
import { ScreenerBlockView } from './ScreenerBlockView';
import { TableBlockView } from './TableBlockView';

function BlockBody({ block, data }: { block: Block; data: BlockData | null | undefined }) {
    switch (block.type) {
        case 'item':
            return <ItemBlockView block={block} data={data?.type === 'item' ? data : data === undefined ? undefined : null} />;
        case 'pair':
            return <PairBlockView block={block} data={data?.type === 'pair' ? data : data === undefined ? undefined : null} />;
        case 'table':
            return <TableBlockView block={block} data={data?.type === 'table' ? data : data === undefined ? undefined : null} />;
        case 'movers':
            return <MoversBlockView block={block} data={data?.type === 'movers' ? data : data === undefined ? undefined : null} />;
        case 'screener':
            return <ScreenerBlockView block={block} data={data?.type === 'screener' ? data : data === undefined ? undefined : null} />;
        case 'chart':
            return <ChartBlockView block={block} data={data?.type === 'chart' ? data : data === undefined ? undefined : null} />;
        case 'note':
            return <NoteBlockView block={block} />;
        case 'heading':
            return <HeadingBlockView block={block} />;
    }
}

/**
 * One block of a panel. `data` is its prices: undefined while they load, null when the block has none. `previous` is the
 * type of the block above, which decides whether a rule is drawn between them (never under a heading).
 */
export function BlockView({
    block,
    data,
    previous,
    outline,
}: {
    block: Block;
    data: BlockData | null | undefined;
    previous: Block | undefined;
    outline?: 'open' | 'idle';
}) {
    const ruled = previous !== undefined && previous.type !== 'heading' && block.type !== 'heading';

    return (
        <BlockFrame ruled={ruled} heading={block.type === 'heading'} outline={outline}>
            <BlockBody block={block} data={data} />
        </BlockFrame>
    );
}
