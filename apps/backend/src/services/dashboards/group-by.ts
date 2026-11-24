/** Items grouped by a key, in first-seen order (`Map.groupBy` needs Node 21; production runs Node 20). */
export function groupBy<T, K>(items: readonly T[], toKey: (item: T) => K): Map<K, T[]> {
    const groups = new Map<K, T[]>();

    for (const item of items) groups.set(toKey(item), [...(groups.get(toKey(item)) ?? []), item]);

    return groups;
}
