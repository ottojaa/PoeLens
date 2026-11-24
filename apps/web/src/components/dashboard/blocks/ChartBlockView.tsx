import { toTrendChange, type ChartBlock, type ChartBlockData } from '@poelens/shared';
import { Change } from '@/components/economy/Change';
import { ItemIcon } from '@/components/economy/ItemIcon';
import { buildSparklinePath } from '@/lib/economy/sparkline';
import { formatDate, formatPrice } from '@/lib/format';
import { BlockMessage, BlockTitle } from './DataRow';
import { toChartTitle } from './block-format';
import { UnitMark } from './UnitMark';

const WIDTH = 300;
const HEIGHT = 84;
/** Where the line's lowest and highest points sit: the same inset the sparkline path keeps, so the guides meet it. */
const INSET = 2;
const GUIDES = [INSET, HEIGHT / 2, HEIGHT - INSET];

/** The line stretches to the block's width; its stroke and guides keep their thickness. */
function Plot({ path, label }: { path: string; label: string }) {
    const area = path + ` L${WIDTH - INSET} ${HEIGHT} L${INSET} ${HEIGHT} Z`;

    return (
        <svg width="100%" height="72" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={label} className="block">
            {GUIDES.map((y) => (
                <line key={y} x1="0" y1={y} x2={WIDTH} y2={y} className="stroke-border" vectorEffect="non-scaling-stroke" />
            ))}
            <path d={area} className="fill-primary/10" />
            <path
                d={path}
                fill="none"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="stroke-primary"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}

function Range({ low, high, data }: { low: number; high: number; data: ChartBlockData }) {
    return (
        <span className="inline-flex items-center gap-1">
            {formatPrice(low)} – {formatPrice(high)}
            {data.unit && <UnitMark unit={data.unit} />}
            {data.quote && <ItemIcon item={data.quote} size="xs" />}
        </span>
    );
}

/** One item's price history (or a pair's rate) as a line with its change, its lowest and highest price and its dates. */
export function ChartBlockView({ block, data }: { block: ChartBlock; data: ChartBlockData | null | undefined }) {
    if (data === undefined) return <BlockMessage>Loading…</BlockMessage>;

    if (data === null) return <BlockMessage>{toChartTitle(block, undefined)}: no price history in this league</BlockMessage>;

    const title = toChartTitle(block, data);
    const prices = data.points.map((point) => point.price);
    const path = buildSparklinePath(prices, WIDTH, HEIGHT);

    if (!path) {
        return (
            <div>
                <BlockTitle>{title}</BlockTitle>
                <BlockMessage>Not enough history yet</BlockMessage>
            </div>
        );
    }

    const first = data.points[0];
    const last = data.points[data.points.length - 1];
    const low = Math.min(...prices);
    const high = Math.max(...prices);
    const label = `${title}: from ${formatPrice(prices[0] ?? 0)} to ${formatPrice(prices[prices.length - 1] ?? 0)}`;

    return (
        <div>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <span className="text-muted-foreground truncate text-xs font-semibold">{title}</span>
                <Change percent={toTrendChange(prices)} className="text-[13px]" />
            </div>
            <Plot path={path} label={label} />
            <div className="text-muted-foreground mt-1 flex items-center justify-between gap-2 text-[11px]">
                <span>{first && formatDate(first.time)}</span>
                <Range low={low} high={high} data={data} />
                <span>{last && formatDate(last.time)}</span>
            </div>
        </div>
    );
}
