import type { NoteBlock } from '@poelens/shared';
import type { ComponentProps } from 'react';
import Markdown, { type Components } from 'react-markdown';

/** Links open in a new tab without handing the page to the target; images are dropped. Raw HTML is never rendered. */
const COMPONENTS: Components = {
    a: ({ node: _node, ...props }: ComponentProps<'a'> & { node?: unknown }) => (
        <a {...props} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline" />
    ),
    img: () => null,
    h1: ({ children }) => <p className="text-foreground mt-2 font-semibold first:mt-0">{children}</p>,
    h2: ({ children }) => <p className="text-foreground mt-2 font-semibold first:mt-0">{children}</p>,
    h3: ({ children }) => <p className="text-foreground mt-2 font-semibold first:mt-0">{children}</p>,
    ul: ({ children }) => <ul className="m-0 flex list-none flex-col gap-0.5 p-0">{children}</ul>,
    li: ({ children }) => (
        <li className="flex gap-2">
            <span aria-hidden="true" className="text-muted-foreground">
                •
            </span>
            <span>{children}</span>
        </li>
    ),
};

/** Markdown text: headings, paragraphs, bullet lists and links, set in the block type's own small size. */
export function NoteBlockView({ block }: { block: NoteBlock }) {
    if (!block.markdown.trim()) return <p className="text-muted-foreground text-[13px]">Empty note</p>;

    return (
        <div className="text-muted-foreground flex flex-col gap-0.5 text-[13px] leading-normal [&_p]:m-0 [&_strong]:text-foreground">
            <Markdown components={COMPONENTS} skipHtml>
                {block.markdown}
            </Markdown>
        </div>
    );
}
