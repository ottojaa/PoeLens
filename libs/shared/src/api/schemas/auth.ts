import { z } from 'zod';

/** Passwords need this many characters and no composition rules. */
export const MIN_PASSWORD_LENGTH = 12;

/** bcrypt ignores everything past 72 bytes, so a longer password would be silently weaker than it looks. */
export const MAX_PASSWORD_BYTES = 72;

export const RoleSchema = z.enum(['admin', 'member']);

/** Trimmed and lower-cased, so the same address is never two accounts. */
export const EmailSchema = z.string().trim().toLowerCase().email().max(254);

export const DisplayNameSchema = z.string().trim().min(1).max(60);

/** The rules for choosing a password (registering, or resetting one). Login accepts anything: the stored hash decides. */
export const NewPasswordSchema = z
    .string()
    .min(MIN_PASSWORD_LENGTH, { message: 'Use at least ' + MIN_PASSWORD_LENGTH + ' characters' })
    .refine((value) => new TextEncoder().encode(value).length <= MAX_PASSWORD_BYTES, {
        message: 'Use at most ' + MAX_PASSWORD_BYTES + ' bytes (about that many characters)',
    });

export const UserSchema = z.object({
    id: z.string().uuid(),
    email: z.string(),
    displayName: z.string(),
    role: RoleSchema,
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    lastLoginAt: z.string().datetime().nullable(),
});

export const LoginRequestSchema = z.object({
    email: EmailSchema,
    password: z.string().min(1).max(1024),
});

/** The access token goes in memory and in `Authorization: Bearer`; the refresh token travels only as the `refresh_token` cookie. */
export const SessionResponseSchema = z.object({
    user: UserSchema,
    accessToken: z.string(),
    /** Seconds until the access token expires. */
    expiresIn: z.number().int(),
});

/** Web and desktop send the cookie; a client that cannot (Android) may send the token it read from `Set-Cookie`. */
export const RefreshRequestSchema = z.object({ refreshToken: z.string().min(1).optional() }).nullish();

export const RefreshResponseSchema = z.object({
    accessToken: z.string(),
    expiresIn: z.number().int(),
});

export const LogoutResponseSchema = z.object({ success: z.literal(true) });

export const CurrentUserResponseSchema = z.object({ user: UserSchema });

export const InvitePreviewSchema = z.object({
    role: RoleSchema,
    expiresAt: z.string().datetime(),
});

/** The token in the invite link, plus the account to create. */
export const RegisterRequestSchema = z.object({
    token: z.string().min(1).max(200),
    email: EmailSchema,
    displayName: DisplayNameSchema,
    password: NewPasswordSchema,
});

export const ResetPasswordRequestSchema = z.object({
    token: z.string().min(1).max(200),
    password: NewPasswordSchema,
});

export const InviteSchema = z.object({
    id: z.string().uuid(),
    role: RoleSchema,
    createdAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
});

export const CreateInviteRequestSchema = z.object({ role: RoleSchema.default('member') });

/** The only time the raw token is shown: the admin page builds `/invite/<token>` from it. */
export const CreateInviteResponseSchema = z.object({ invite: InviteSchema, token: z.string() });

export const InvitesResponseSchema = z.object({ invites: z.array(InviteSchema) });

export const UsersResponseSchema = z.object({ users: z.array(UserSchema) });

export const ResetLinkResponseSchema = z.object({ token: z.string(), expiresAt: z.string().datetime() });

export const IdParamsSchema = z.object({ id: z.string().uuid() });

export const TokenParamsSchema = z.object({ token: z.string().min(1).max(200) });

export type Role = z.infer<typeof RoleSchema>;
export type User = z.infer<typeof UserSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;
export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof ResetPasswordRequestSchema>;
export type InvitePreview = z.infer<typeof InvitePreviewSchema>;
export type Invite = z.infer<typeof InviteSchema>;
export type CreateInviteResponse = z.infer<typeof CreateInviteResponseSchema>;
export type ResetLinkResponse = z.infer<typeof ResetLinkResponseSchema>;
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;
export type CurrentUserResponse = z.infer<typeof CurrentUserResponseSchema>;
export type CreateInviteRequest = z.infer<typeof CreateInviteRequestSchema>;
export type InvitesResponse = z.infer<typeof InvitesResponseSchema>;
export type UsersResponse = z.infer<typeof UsersResponseSchema>;
export type IdParams = z.infer<typeof IdParamsSchema>;
export type TokenParams = z.infer<typeof TokenParamsSchema>;
