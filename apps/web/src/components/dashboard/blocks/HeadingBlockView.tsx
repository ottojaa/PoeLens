import type { HeadingBlock } from '@poelens/shared';

/** A section title with a rule after it; with no text it is a plain divider. */
export function HeadingBlockView({ block }: { block: HeadingBlock }) {
    return (
        <div className="text-muted-foreground flex items-center gap-2.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
            {block.text && <h3 className="m-0 text-[11px] font-semibold">{block.text}</h3>}
            <span aria-hidden="true" className="bg-border h-px flex-1" />
        </div>
    );
}
