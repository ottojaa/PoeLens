import type { Block } from './blocks.js';
import type { GridRect } from './grid.js';

/**
 * How big a panel is when a block is its first: wide enough for the block's layout, and as tall as its rows. A table's
 * height follows its row count, so a short table does not leave an empty panel.
 */
export function toNewPanelSize(block: Block): Pick<GridRect, 'w' | 'h'> {
    switch (block.type) {
        case 'table':
            return { w: 5, h: 5 + Math.min(block.limit, 20) };
        case 'movers':
            return { w: 5, h: 5 + 3 * Math.min(block.limit, 6) };
        case 'screener':
            return { w: 4, h: 4 + 2 * Math.min(block.limit, 8) };
        case 'chart':
            return { w: 4, h: 8 };
        case 'item':
            return block.display === 'card' ? { w: 3, h: 6 } : { w: 3, h: 4 };
        case 'pair':
            return { w: 4, h: 4 };
        case 'note':
            return { w: 3, h: 6 };
        case 'heading':
            return { w: 4, h: 3 };
    }
}
