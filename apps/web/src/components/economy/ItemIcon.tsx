import type { ItemRef } from '@poelens/shared';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const SIZES = { sm: 'size-8 rounded-lg text-[13px]', md: 'size-9 rounded-lg text-sm', lg: 'size-[60px] rounded-2xl text-2xl' } as const;

/**
 * An item's picture from the game's own image host, or its initial in a tile when it has none or it fails to load.
 * The referrer is withheld, so the host learns nothing about where the picture is shown.
 */
export function ItemIcon({ item, size = 'sm' }: { item: Pick<ItemRef, 'name' | 'icon'>; size?: keyof typeof SIZES }) {
    const [failed, setFailed] = useState(false);
    const frame = cn('bg-secondary border-input text-primary grid shrink-0 place-items-center overflow-hidden border font-bold', SIZES[size]);

    if (!item.icon || failed) {
        return (
            <span aria-hidden="true" className={frame}>
                {item.name.charAt(0).toUpperCase()}
            </span>
        );
    }

    return (
        <span aria-hidden="true" className={frame}>
            <img
                src={item.icon}
                alt=""
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setFailed(true)}
                className="size-full object-contain p-0.5"
            />
        </span>
    );
}
