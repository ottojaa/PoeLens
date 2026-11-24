import { CATEGORIES, type WatchlistUnlisted } from '@poelens/shared';
import { Link } from '@tanstack/react-router';
import { ItemIcon } from '@/components/economy/ItemIcon';
import type { WatchControls } from '@/lib/watchlist/controls';
import { GAME } from '@/lib/economy/use-economy-context';
import { AnimatedList } from '@/motion/AnimatedList';
import { WatchStar } from './WatchStar';

/** Watched items the league has no price for: kept on the list so they can be opened or removed. */
export function UnlistedItems({ items, league, controls }: { items: readonly WatchlistUnlisted[]; league: string; controls: WatchControls }) {
    if (items.length === 0) return null;

    return (
        <section aria-labelledby="unlisted-heading" className="flex flex-col gap-2">
            <h2 id="unlisted-heading" className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                Not listed in {league}
            </h2>
            <div className="bg-card overflow-hidden rounded-xl border">
                <AnimatedList
                    items={items}
                    getKey={({ item }) => String(item.id)}
                    className="divide-y"
                    renderItem={({ item }) => (
                        <div className="flex items-center gap-2 py-2 pr-4 pl-2">
                            <WatchStar name={item.name} watched={controls.isWatched(item.id)} onToggle={(watched) => controls.onToggle(item, watched)} />
                            <Link
                                to="/items/$itemId"
                                params={{ itemId: String(item.id) }}
                                className="focus-visible:ring-ring/50 flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-[3px]"
                            >
                                <ItemIcon item={item} />
                                <span className="flex min-w-0 flex-col">
                                    <span className="truncate font-semibold">{item.name}</span>
                                    <span className="text-muted-foreground truncate text-xs">
                                        {CATEGORIES[GAME].find((category) => category.id === item.category)?.label ?? item.category}
                                    </span>
                                </span>
                            </Link>
                        </div>
                    )}
                />
            </div>
        </section>
    );
}
