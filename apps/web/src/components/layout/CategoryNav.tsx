import { CATEGORY_GROUP_LABELS, type Category, type CategoryGroup } from '@poelens/shared';
import { Link } from '@tanstack/react-router';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const GROUP_ORDER: readonly CategoryGroup[] = ['economy', 'uniques'];

export const NAV_ITEM_CLASS = 'text-muted-foreground h-auto w-full justify-between rounded-lg px-3 py-2 font-normal disabled:opacity-60';

export function NavHeading({ children, className }: { children: string; className?: string }) {
    return (
        <span className={cn('text-muted-foreground px-3 pt-4 pb-1.5 text-xs font-semibold tracking-wider uppercase first:pt-1.5', className)}>{children}</span>
    );
}

/** The economy categories, grouped, as links to each category's table. League and unit ride along in the URL. */
export function CategoryNav({
    categories,
    value,
    onNavigate,
}: {
    categories: readonly Category[];
    value: string | null;
    /** Called when a link is followed, so a drawer can close itself. */
    onNavigate?: () => void;
}) {
    return (
        <>
            {GROUP_ORDER.map((group) => {
                const inGroup = categories.filter((category) => category.group === group);

                if (inGroup.length === 0) return null;

                return (
                    <div key={group} role="group" aria-label={CATEGORY_GROUP_LABELS[group]} className="flex flex-col gap-0.5">
                        <NavHeading>{CATEGORY_GROUP_LABELS[group]}</NavHeading>
                        {inGroup.map((category) => (
                            <Link
                                key={category.id}
                                to="/economy/$category"
                                params={{ category: category.id }}
                                aria-current={category.id === value ? 'page' : undefined}
                                onClick={onNavigate}
                                className={cn(buttonVariants({ variant: 'ghost' }), NAV_ITEM_CLASS, category.id === value && 'bg-accent text-foreground')}
                            >
                                {category.label}
                            </Link>
                        ))}
                    </div>
                );
            })}
        </>
    );
}
