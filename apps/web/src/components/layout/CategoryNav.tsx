import { CATEGORY_GROUP_LABELS, type Category, type CategoryGroup } from '@poelens/shared';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Soon } from './Soon';

const GROUP_ORDER: readonly CategoryGroup[] = ['economy', 'uniques'];

export const NAV_ITEM_CLASS = 'text-muted-foreground h-auto w-full justify-between rounded-lg px-3 py-2 font-normal disabled:opacity-60';

export function NavHeading({ children, className }: { children: string; className?: string }) {
    return (
        <span className={cn('text-muted-foreground px-3 pt-4 pb-1.5 text-xs font-semibold tracking-wider uppercase first:pt-1.5', className)}>{children}</span>
    );
}

/** The economy categories, grouped. Controlled: the economy view will own the selection. */
export function CategoryNav({
    categories,
    value,
    onChange,
    disabled = false,
}: {
    categories: readonly Category[];
    value: string | null;
    onChange: (categoryId: string) => void;
    disabled?: boolean;
}) {
    return (
        <>
            {disabled && (
                <p className="text-muted-foreground flex items-center gap-2 px-3 pt-3 pb-1 text-xs">
                    Browsing arrives with the economy view <Soon />
                </p>
            )}
            {GROUP_ORDER.map((group) => {
                const inGroup = categories.filter((category) => category.group === group);

                if (inGroup.length === 0) return null;

                return (
                    <div key={group} role="group" aria-label={CATEGORY_GROUP_LABELS[group]} className="flex flex-col gap-0.5">
                        <NavHeading>{CATEGORY_GROUP_LABELS[group]}</NavHeading>
                        {inGroup.map((category) => (
                            <Button
                                key={category.id}
                                type="button"
                                variant="ghost"
                                disabled={disabled}
                                aria-current={category.id === value ? 'page' : undefined}
                                onClick={() => onChange(category.id)}
                                className={cn(NAV_ITEM_CLASS, category.id === value && 'bg-accent text-foreground')}
                            >
                                {category.label}
                            </Button>
                        ))}
                    </div>
                );
            })}
        </>
    );
}
