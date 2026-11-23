import { UnitSchema } from '@poelens/shared';
import { z } from 'zod';

// The parts of poe.ninja's responses the parser reads. They are unversioned, so each schema asks only for what is used
// and ignores the rest: an added field never breaks a parse, a removed or renamed one does, loudly.

export const LeaguesBodySchema = z.array(z.object({ id: z.string(), name: z.string().min(1) })).min(1);

const CoreSchema = z.object({
    /** The unit every `primaryValue` is in. */
    primary: UnitSchema,
    /** How many of each other unit one primary unit is worth. */
    rates: z.record(z.string(), z.number()),
});

export const ExchangeBodySchema = z.object({
    core: CoreSchema,
    lines: z.array(
        z.object({
            id: z.string().min(1),
            primaryValue: z.number().nonnegative(),
            volumePrimaryValue: z.number().nonnegative(),
        }),
    ),
    items: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), image: z.string().nullish() })),
});

export const StashBodySchema = z.object({
    core: CoreSchema,
    lines: z.array(
        z.object({
            detailsId: z.string().min(1),
            name: z.string().min(1),
            baseType: z.string().nullish(),
            icon: z.string().nullish(),
            primaryValue: z.number().nonnegative(),
            listingCount: z.number().int().nonnegative(),
        }),
    ),
});
